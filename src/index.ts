import { Context, Schema, Session, Time, segment } from "koishi"
import type {} from "@koishijs/plugin-help" // used to define hidden options
import { getRandomImage, LoadedImage, loadImage, setBooruUrl } from "./api"
import ErrorWrapper from "./error-wrapper"
import { pathToFileURL } from "url"

export const name = "lnnbot-derpi"
export interface Config {
  /** 图站网址 */
  booruUrl: string
  /** 获取图片时使用的过滤器编号 */
  filterId: number
  /** 随机图片必须满足的条件 */
  restrictions: string
  /** 收到请求后，延迟多长时间发送“请稍候” */
  holdOnTime: number
  /** 在指定时间内，同一频道内如果已经请求过图片，则不再发送“请稍候” */
  omitHoldOnTimeout: number
  /** 在请求了一次随机图后，请求“再来一张”的有效期 */
  anotherTimeout: number
  /** 定义要注册的 `derpi.random` 指令快捷方式 */
  randomShortcuts: {
    /** 快捷方式的名称，如需要“随机小马图”则填写 `"小马"`。可以指定多个。 */
    name: string | string[]
    /** 对应的搜索词 */
    query: string
    options?: {
      /**
       * 指定最高可能出现的 R34 分级。
       *
       * `1` 表示性暗示，`2` 表示强烈性暗示，`3` 表示露骨性描写。默认为 `0`，表示全部不允许。
       */
      r34?: 0 | 1 | 2 | 3
      /**
       * 指定最高可能出现的黑暗内容分级。
       *
       * `1` 表示轻度黑暗，`2` 表示重度黑暗。默认为 `0`，表示全部不允许。
       */
      dark?: 0 | 1 | 2
      /** 指定是否可能出现血腥或恶心的图片 */
      grotesq?: boolean
    }
  }[]
}

export const Config: Schema<Config> = Schema.object({
  booruUrl: Schema.string().description("图站网址。").default("https://derpibooru.org"),
  filterId: Schema.number().description("获取图片时使用的过滤器编号。").default(191275),
  restrictions: Schema.string()
    .role("textarea")
    .description("随机图片必须满足的条件。会自动添加到所有搜索词中。")
    .default("wilson_score.gte:0.93"),
  holdOnTime: Schema.number()
    .description("收到请求后，延迟多长时间发送“请稍候”。（毫秒）")
    .default(5 * Time.second),
  omitHoldOnTimeout: Schema.number()
    .description("同一频道内如果已经请求过图片，多长时间内不再发送“请稍候”。（毫秒）")
    .default(5 * Time.minute),
  anotherTimeout: Schema.number()
    .description("在请求了一次随机图后，请求“再来一张”的有效期。（毫秒）")
    .default(5 * Time.minute),
  randomShortcuts: Schema.array(
    Schema.object({
      name: Schema.union([
        Schema.array(String).role("table"),
        Schema.transform(String, s => [s]),
      ])
        .required()
        .description("快捷方式的名称，如需要“随机小马图”则填写 `小马`。可指定多个。"),
      query: Schema.string().role("textarea").description("对应的搜索词。"),
      options: Schema.union([
        Schema.const(undefined).description("不允许敏感内容（safe）"),
        Schema.object({
          r34: Schema.union([
            Schema.const(0).description("全部不允许"),
            Schema.const(1).description("suggestive"),
            Schema.const(2).description("questionable"),
            Schema.const(3).description("explicit"),
          ])
            .description("最高允许出现的 R34 分级。")
            .default(0),
          dark: Schema.union([
            Schema.const(0).description("全部不允许"),
            Schema.const(1).description("semi-grimdark"),
            Schema.const(2).description("grimdark"),
          ])
            .description("最高允许出现的黑暗内容分级。")
            .default(0),
          grotesq: Schema.union([
            Schema.const(false).description("不允许"),
            Schema.const(true).description("grotesque"),
          ])
            .description("是否允许出现血腥或恶心的图片。")
            .default(false),
        })
          .role("table")
          .description("自定义"),
      ]).description("分级选项。"),
    })
  )
    .description("为 `derpi.random` 指令注册快捷方式。")
    .default([
      {
        name: ["小马"],
        query: "pony",
        options: undefined,
      },
      {
        name: ["暮暮", "紫悦", "TS"],
        query: "ts,pony,solo",
        options: undefined,
      },
      {
        name: ["萍琪", "碧琪", "PP"],
        query: "pp,pony,solo",
        options: undefined,
      },
      {
        name: ["阿杰", "嘉儿", "AJ"],
        query: "aj,pony,solo",
        options: undefined,
      },
      {
        name: ["柔柔", "小蝶", "FS"],
        query: "fs,pony,solo",
        options: undefined,
      },
      {
        name: ["云宝", "戴茜", "黛茜", "黛西", "RD"],
        query: "rd,pony,solo",
        options: undefined,
      },
      {
        name: ["瑞瑞", "珍奇", "RY"],
        query: "ry,pony,solo",
        options: undefined,
      },
    ]),
})

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger("derpi")
  setBooruUrl(config.booruUrl)

  /**
   * 记录各个频道最近一次获取图片的时间；若当前正在为该频道获取图片中，记为 `NaN`。
   */
  const lastInvokeTimeMap = new Map<string, number>()
  /**
   * 记录各个频道最近一次获取随机图时所用的 query；若最近一次调用不是获取随机图片，则该频道无记录。
   */
  const lastQueryMap = new Map<string, string>()

  async function sendImage(session: Session, promise: Promise<LoadedImage>) {
    const lastInvokeTime = lastInvokeTimeMap.get(session.cid) ?? -Infinity
    if (isNaN(lastInvokeTime)) return session.text(".too-fast")
    lastInvokeTimeMap.set(session.cid, NaN)

    let holdOnHandle: NodeJS.Timeout | null = null
    const elapsedTime = Date.now() - lastInvokeTime
    if (elapsedTime > config.omitHoldOnTimeout)
      holdOnHandle = setTimeout(() => {
        session.send(session.text(".hold-on"))
      }, config.holdOnTime)

    let id: number
    let outPath: string
    try {
      ;({ id, outPath } = await promise)
    } catch (err) {
      if (err instanceof ErrorWrapper) {
        if (err.error) logger.warn(err.error)
        return session.text(...err.message)
      }
      logger.error(err)
      return session.text("internal.error-encountered")
    } finally {
      if (holdOnHandle !== null) clearTimeout(holdOnHandle)
      lastInvokeTimeMap.set(session.cid, Date.now())
    }

    return (
      segment.image(pathToFileURL(outPath).href) + `\n${config.booruUrl}/images/${id}`
    )
  }

  const cmdDerpi = ctx.command("derpi <id:natural>", {
    checkArgCount: true,
    checkUnknown: true,
    showWarning: true,
  })
  cmdDerpi.action(({ session }, id) => {
    lastQueryMap.delete(session.cid)
    return sendImage(session, loadImage(id))
  })

  const cmdDerpiRandom = ctx
    .command("derpi.random [query:string]", {
      //checkArgCount: true,
      checkUnknown: true,
      showWarning: true,
    })
    .option("r34", "<level:number>", { fallback: 0, hidden: true })
    .option("r34", "-s", { value: 1 })
    .option("r34", "-q", { value: 2 })
    .option("r34", "-e", { value: 3 })
    .option("dark", "<level:number>", { fallback: 0, hidden: true })
    .option("dark", "-S", { value: 1 })
    .option("dark", "-g", { value: 2 })
    .option("grotesq", "-G", { fallback: false, hidden: true })
    .alias("再来", "再来一张")

  const randomShortcutsUsage = config.randomShortcuts.map(({ name, query, options }) => {
    const nameArr: string[] = typeof name === "string" ? [name] : name
    for (const name of nameArr) {
      cmdDerpiRandom.alias(`随机${name}图`, { args: [query], options })
    }

    return `随机${nameArr.join("/")}图`
  })

  cmdDerpiRandom
    .usage(
      session =>
        `${session.text("commands.derpi.random.messages.usage")}\n` +
        `${session.text("commands.derpi.random.messages.usage-another")}\n` +
        (randomShortcutsUsage.length
          ? `${session.text("commands.derpi.random.messages.usage-shortcuts")}\n` +
            randomShortcutsUsage.map(s => `    ${s}`).join("\n")
          : "")
    )
    .action(({ session, options: { r34, dark, grotesq } }, query) => {
      let q: string
      if (query) {
        const restrictions = [`(${config.restrictions})`]
        if (r34 || dark || grotesq) {
          switch (r34) {
            case 0:
              restrictions.push("-suggestive") // fallthrough
            case 1:
              restrictions.push("-questionable") // fallthrough
            case 2:
              restrictions.push("-explicit")
          }
          switch (dark) {
            case 0:
              restrictions.push("-semi-grimdark") // fallthrough
            case 1:
              restrictions.push("-grimdark")
          }
          if (!grotesq) restrictions.push("-grotesque")
        } else {
          restrictions.push("safe")
        }
        q = `(${query}),${restrictions.join(",")}`
        lastQueryMap.set(session.cid, q)
      } else {
        if (r34 || dark || grotesq) return session.text(".require-query")
        const elapsedTime = Date.now() - (lastInvokeTimeMap.get(session.cid) ?? -Infinity)
        if (elapsedTime > config.anotherTimeout || !lastQueryMap.has(session.cid))
          return session.text(".require-query")
        q = lastQueryMap.get(session.cid)
      }
      const opt = Object.assign(
        { q },
        config.filterId >= 0 ? { filter_id: config.filterId } : null
      )
      return sendImage(session, getRandomImage(opt))
    })

  ctx.i18n.define("zh", require("./locales/zh"))
}
