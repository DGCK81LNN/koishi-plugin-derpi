import { HTTP, Random, SessionError } from "koishi"
import { GetImageResponse, Image, SearchImagesResponse } from "./types"
import fs from "fs"
import path from "path"
import { ReadableStream } from "stream/web"
import { promises as streamPromises, Readable } from "stream"

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

async function apiCall<T>(http: HTTP, path: string, params: Params) {
  let url = `${booruUrl}/api/v1/json/${path}`
  const paramStr = new URLSearchParams(params).toString()
  if (paramStr) url += (url.includes("?") ? "&" : "?") + paramStr
  return await http.get<T>(url)
}

export async function loadImageMetadata(http: HTTP, id: number, options: Options) {
  let meta: GetImageResponse
  try {
    meta = await apiCall(http, `images/${id}`, options as Params)
  } catch (cause) {
    throw Object.assign(new SessionError(".metadata-error"), { cause })
  }
  return meta.image
}

export interface LoadedImage {
  id: number
  outPath: string
}

export function loadImage(http: HTTP, id: number, options?: Options): Promise<LoadedImage>
export function loadImage(http: HTTP, meta: Image): Promise<LoadedImage>
export async function loadImage(
  http: HTTP,
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

  const meta =
    typeof param === "number" ? await loadImageMetadata(http, param, options) : param

  if (meta.hidden_from_users === true) throw new SessionError(".is-removed")
  if (meta.mime_type.startsWith("video/")) throw new SessionError(".is-video")

  let imgStream: ReadableStream
  try {
    imgStream = await http.get(meta.representations.large, {
      responseType: "stream",
    })
  } catch (cause) {
    throw Object.assign(new SessionError(".image-error"), { cause })
  }

  await streamPromises.pipeline(
    Readable.fromWeb(imgStream),
    fs.createWriteStream(outPath)
  )

  return { id: meta.id, outPath }
}

export async function getRandomImage(http: HTTP, options?: Options) {
  options = Object.assign(
    {
      sf: `random:${Random.int(0, 0x100000000)}`,
      sd: "desc",
    },
    options
  )
  let result: SearchImagesResponse
  try {
    result = await apiCall(http, "search/images", options as Params)
  } catch (cause) {
    throw Object.assign(new SessionError(".metadata-error"), { cause })
  }

  if (result.images.length === 0) throw new SessionError(".no-result")
  const meta = result.images[0]

  return await loadImage(http, meta)
}
