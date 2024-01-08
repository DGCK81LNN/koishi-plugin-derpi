import { resolve as pathResolve } from "node:path"

export function toFileURL(...p: string[]) {
  return `file:///${pathResolve(...p).replace(/^\//, "")}`
}
