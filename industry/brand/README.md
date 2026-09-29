# 气市观察品牌资源

`wordmark.svg` 是完整的横向 Logo：左侧图标，右侧站名和“关注气源与市场”。文字已经转为路径，不依赖访客电脑的字体，也不带位图的透明边距。

- 画板：258 × 84；图标占 84 × 84，明显高于右侧文字组。
- 主副标题的可见左右两端对齐，副标题通过均匀字距匹配标题宽度，不拉伸字形。图标与整组文字共用水平中轴 y=42；可见图文间隔约 18。
- 标题使用 Noto Sans SC Medium，副标题使用 Regular；字形高度分别为 34、18，两行间隔 10。文字组高 62，上下各留 11。
- 深浅色模式复用同一份几何路径，通过 `ink`、`accent`、`tagline` 分别取页面的文字、强调和次要文字颜色。

需要改文字时，用 `@fontsource/noto-sans-sc@5.3.0` 的字体包重新生成：

```bash
node industry/brand/generate-wordmark.mjs <字体包目录>
```

字体按 SIL Open Font License 1.1 使用，见 `FONT-LICENSE.txt`。接入位置是 `docs/customize.md` 指定的 `apps/web/app/components/Logo.tsx`。
