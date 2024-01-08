# @dgck81lnn/koishi-plugin-derpi

[![npm](https://img.shields.io/npm/v/@dgck81lnn/koishi-plugin-derpi?style=flat-square)](https://www.npmjs.com/package/@dgck81lnn/koishi-plugin-derpi)

随机 Derpibooru 图片

## 用法

### `derpi`

```
指令：derpi <id>
获取呆站图片
```

例：`derpi 1335306`

### `derpi.random`

```
指令：derpi random [query]
随机获取呆站图片
输入 derpi.random，后加一个 Derpibooru 搜索串，用于筛选图片。若搜索串中有空格，需给整个搜索串加引号。
省略搜索串或输入“再来一张”（或“再来”）可重复最近一次请求。
也可以直接使用以下快捷方式来调用预设的搜索串和选项：
    随机小马图
    随机暮暮/紫悦/TS图
    随机萍琪/碧琪/PP图
    随机阿杰/嘉儿/AJ图
    随机柔柔/小蝶/FS图
    随机云宝/戴茜/黛茜/黛西/RD图
    随机瑞瑞/珍奇/RY图
```

例：`derpi.random "pony, sunset shimmer"`

该指令有几个隐藏选项：

  * `--r34 <level>`  指定最高允许的 R34 分级：`--r34 1` 或 `-s` 表示 `suggestive`，`--r34 2` 或 `-q` 表示 `questionable`，`--r34 3` 或 `-e` 表示 `explicit`

  * `--dark <level>`  指定最高允许的黑暗内容分级：`--dark 1` 或 `-S` 表示 `semi-grimdark`，`--dark 2` 或 `-g` 表示 `grimdark`

  * `--grotesq`, `-G`  若指定，则允许血腥或恶心（`grotesque`）的图片

不指定上述任何选项的情况下，默认只显示 `safe` 分级的图片。

## 主要配置项

  * `booruUrl`：图站网址。默认为 [Derpibooru](https://derpibooru.org) `https://derpibooru.org`。若机器人网络无法访问 Derpibooru，可将此项设为其另一域名 `https://trixiebooru.org`。也可以设置为其他基于 [Philomena](https://github.com/philomena-dev/philomena) 的图站，如 [Ponybooru](https://ponybooru.org) `https://ponybooru.org`、[Furbooru](https://furbooru.org) `https://furbooru.org`、[Ponerpics](https://ponerpics.org) `https://ponerpics.org`、[Manebooru](https://manebooru.art) `https://manebooru.art`。

  * `filterId`：获取随机图片时使用的过滤器编号。默认为 [191275](https://derpibooru.org/filters/191275)。被该过滤器隐藏的图片不会出现在随机图结果中。若使用 Derpibooru 以外的图站，需要到相应图站上创建或选择合适的过滤器，然后将此项设置成过滤器详情页的网址中“`/filters/`”后的数字。设置为 -1 时使用图站的默认过滤器。

  * `restrictions`：随机图片必须满足的搜索词。会自动添加到所有搜索词中。默认为 `wilson_score.gte:0.93`（威尔逊得分不低于 0.93）。

  * `randomShortcuts`：定义随机图片的预设搜索词快捷方式。默认为“随机**小马**图” = `derpi.random pony`、“随机**暮暮**/**紫悦**/**TS**图” = `derpi.random ts,pony,solo` 等 7 个。

关于其余配置项，请到 Koishi 控制台安装并应用本插件后查看。
