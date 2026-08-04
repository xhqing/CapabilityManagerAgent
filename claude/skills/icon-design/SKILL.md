---
name: icon-design
description: "Use this skill whenever you are about to create or modify ANY icon, logo, favicon, app icon, agent logo, badge-style graphic, or README header image — in SVG, PNG, or any format — for a project, VSCode extension, app, or agent. Read it BEFORE drawing the first shape or picking colors. Enforces rounded-only outlines (no sharp corners), color harmony, composition, and a pre-flight checklist. Triggers on: 'icon', 'logo', '图标', '徽标', 'favicon', 'app icon', '扩展图标', '设计图标', '画个 logo', '做个图标'."
---

# 图标 / Logo 设计规范

设计 icon、扩展图标、项目 logo、agent logo、favicon、头像、徽章等**任何图标类视觉元素**时，必须达到「有设计感、有品味」的底线，不能随意凑一个就交差。本 skill 适用于所有出图场景，包括 commit skill 的 LOGO 生成、agent 脚手架的 `assets/logo.svg`、VSCode 扩展图标等。

## 一、外轮廓形状（硬性要求）

外轮廓**必须是圆角矩形、圆角正方形、圆形**三者之一，**一律用圆角，不许有棱角**——直角、锐角、尖角一律禁止。

- **圆角矩形 / 圆角正方形**：四角用 `rx` 倒圆角。圆角要够大、肉眼可见，不要用 `rx=4` 这种近乎直角的小倒角糊弄。
  - 扩展图标（512×512）：`rx=112` 左右（约占边长 22%）
  - 项目 logo 横幅（640×200）：`rx=28`
  - 通用 app 图标（1024×1024）：`rx=225` 左右
- **圆形**：等宽高 + `rx` 取半径（= 宽度的一半），或直接用 `<circle>`。

## 二、品味要求（每次都要自检）

- **配色协调**：优先用渐变，避免高饱和纯色撞色；主色搭配邻近色，深浅要有层次，不要刺眼。一组稳妥的配色：主色 + 主色的深一档（做渐变两端）+ 中性背景。
- **构图**：主体居中、四周留白舒适（主体不要顶满边缘，四周留约 10%–15% 边距做呼吸空间）、元素比例协调、风格统一。
- **不堆砌**：元素精炼，不花哨、不杂乱。emoji 可以用，但要搭配合适的色卡背景与构图，不要在纯色块上随手丢一个 emoji 就算图标。

## 三、出图前自检清单（三项全过才算完成）

- [ ] ① 外轮廓是圆角矩形 / 圆角正方形 / 圆形？有棱角则改圆角。
- [ ] ② 配色协调？无刺眼撞色、有层次？
- [ ] ③ 主体居中、留白舒适、比例协调？

## 四、标准圆角图标 SVG 骨架（可直接改用）

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="<图标描述>">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="<主色亮>"/>
      <stop offset="100%" stop-color="<主色深>"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <!-- 主体图形居中放这里；若用 emoji，配 dominant-baseline="central" + text-anchor="middle" 在 (256,256) 居中 -->
</svg>
```

要点：圆角矩形背景（`rx=112`）+ 渐变填充 + 居中主体。

## 五、为什么

图标是项目和产品的门面，第一眼决定观感与信任。尖锐棱角、随意构图显得廉价、不专业；圆角更现代、柔和、有品质感，也贴合当下主流设计语言（macOS、iOS、Material 都以圆角为主）。
