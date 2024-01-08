export interface GetImageResponse {
  image: Image
}

export interface SearchImagesResponse {
  images: VisibleImage[]
  total: number
}

export type ImageMimeType =
  | "image/gif"
  | "image/jpeg"
  | "image/png"
  | "image/svg+xml"
  | "video/webm"
  | "video/mp4" // derpibooru does not spport mp4s but ponybooru, for example, does
export type ImageExtension<T extends ImageMimeType = ImageMimeType> =
  T extends "image/gif"
    ? "gif"
    : T extends "image/jpeg"
    ? "jpg" | "jpeg"
    : T extends "image/png"
    ? "png"
    : T extends "image/svg+xml"
    ? "svg"
    : T extends "video/webm"
    ? "webm"
    : T extends "video/mp4"
    ? "mp4"
    : never

interface ImageBasicInfo {
  created_at: string
  deletion_reason?: string
  duplicate_of?: number
  first_seen_at: string
  id: number
  hidden_from_users: boolean
  updated_at: string
}
export interface VisibleImage<M extends ImageMimeType = ImageMimeType>
  extends ImageBasicInfo {
  animated: boolean
  aspect_ratio: number
  comment_count: number
  description: string
  downvotes: number
  duration: number
  faves: number
  format: ImageExtension<M>
  height: number
  hidden_from_users: false
  intensities?: { ne: number; nw: number; se: number; sw: number }
  mime_type: M
  name: string
  orig_sha512_hash: string
  processed: boolean
  representations: {
    full: string
    large: string
    medium: string
    small: string
    tall: string
    thumb: string
    thumb_small: string
    thumb_tiny: string
  }
  score: number
  sha512_hash: string
  size: number
  source_url: string
  spoilered: boolean
  tag_count: number
  tag_ids: number[]
  tags: string[]
  thumbnails_generated: boolean
  uploader: string
  uploader_id?: number
  upvotes: number
  view_url: string
  width: number
  wilson_score: number
}
export interface HiddenImage extends ImageBasicInfo {
  hidden_from_users: true
}
export type Image = VisibleImage | HiddenImage
