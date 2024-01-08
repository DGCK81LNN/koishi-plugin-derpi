import { Random } from "koishi"
import { GetImageResponse, Image, SearchImagesResponse } from "./types"
import ErrorWrapper from "./error-wrapper"
import fs from "fs"
import path from "path"
import Stream from "stream"
import axios, { AxiosResponse } from "axios"

type Params = string | [string, string][] | Record<string, string> | URLSearchParams

interface Options {
  filter_id?: number
  key?: string
  page?: number
  per_page?: number
  q?: string
  sd?: "desc" | "asc"
  sf?: string
}

let booruUrl = "https://derpibooru.org"

export function setBooruUrl(url: string) {
  booruUrl = url
}

async function apiCall<T>(path: string, params: Params) {
  let url = `${booruUrl}/api/v1/json/${path}`
  const paramStr = new URLSearchParams(params).toString()
  if (paramStr) url += (url.includes("?") ? "&" : "?") + paramStr
  return (await axios.get<T>(url)).data
}

export async function loadImageMetadata(id: number, options: Options) {
  let meta: GetImageResponse
  try {
    meta = await apiCall(`images/${id}`, options as Params)
  } catch (err) {
    throw new ErrorWrapper([".metadata-error"], err)
  }
  return meta.image
}

export interface LoadedImage {
  id: number
  outPath: string
}

export function loadImage(id: number, options?: Options): Promise<LoadedImage>
export function loadImage(meta: Image): Promise<LoadedImage>
export async function loadImage(
  param: number | Image,
  options?: Options
): Promise<LoadedImage> {
  const id = typeof param === "number" ? param : param.id

  const outPath = path.resolve(`./.lnnbot_cache/${id}`)

  try {
    await fs.promises.lstat(outPath)
    return { id, outPath } // image already cached
  } catch {
    // image not cached
  }

  await fs.promises.mkdir(path.dirname(outPath), { recursive: true })

  const meta = typeof param === "number" ? await loadImageMetadata(param, options) : param

  if (meta.hidden_from_users === true) throw new ErrorWrapper([".is-removed"])
  if (meta.mime_type.startsWith("video/")) throw new ErrorWrapper([".is-video"])

  let imgResponse: AxiosResponse
  try {
    imgResponse = await axios.get(meta.representations.large, {
      responseType: "stream",
    })
  } catch (err) {
    throw new ErrorWrapper([".image-error"], err)
  }

  const imgStream = imgResponse.data
  await Stream.promises.pipeline(imgStream, fs.createWriteStream(outPath))

  return { id: meta.id, outPath }
}

export async function getRandomImage(options?: Options) {
  options = Object.assign(
    {
      sf: `random:${Random.int(0, 0x100000000)}`,
      sd: "desc",
    },
    options
  )
  let result: SearchImagesResponse
  try {
    result = await apiCall("search/images", options as Params)
  } catch (err) {
    throw new ErrorWrapper([".metadata-error"], err)
  }

  if (result.images.length === 0) throw new ErrorWrapper([".no-result"])
  const meta = result.images[0]

  return await loadImage(meta)
}
