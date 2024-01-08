import { Session } from "koishi"

export default class ErrorWrapper {
  constructor(
    public message: Parameters<typeof Session.prototype.text>,
    public error?: Error
  ) {}
}
