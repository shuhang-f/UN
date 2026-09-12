import { resolve } from "node:path";

export function dataDirectory(name = "") {
  return resolve(process.env.UN_DATA_DIR || ".data", name);
}
