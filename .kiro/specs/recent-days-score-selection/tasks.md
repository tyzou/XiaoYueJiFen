# 实施计划：recent-days-score-selection

## 概述

本计划把 `design.md` 拆分成若干增量编码任务。任务按"先纯函数 → 再服务层 → 再路由层 → 再 SSR/视图 → 再前端脚本与样式 → 集成"的顺序推进，使每一步都能在前一步基础上立即被验证。

每个 Property 都拆为一个独立的属性测试子任务，注释格式统一为：

```
// Feature: recent-days-score-selection, Property N: <property text>
```

其中 `<property text>` 与 `design.md` 中该属性正文一字不差。所有属性测试调用 `fc.assert(p, { numRuns: 100 })` 或更高。

带 `*` 的子任务为可选（测试相关），实现时可跳过；不带 `*` 的子任务为核心实现，必须完成。

## 任务

- [x] 1. 搭建测试基础设施（Vitest + fast-check + supertest + jsdom）
  - 在 `package.json` 的 `devDependencies` 中追加 `vitest`、`fast-check`、`supertest`、`@vitest/expect`，并确认 `jsdom` 由 vitest 内置可用（必要时显式追加 `jsdom`）
  - 在 `package.json` 的 `scripts` 中追加 `"test": "vitest --run"` 与 `"test:property": "vitest --run tests/property"`
  - 新建 `vitest.config.js`，默认环境 `node`，对 `tests/**/dom-*.test.js` 与 `tests/property/dateSelector.property.test.js` 切换为 `jsdom`
  - 新建 `tests/` 目录骨架：`tests/unit/`、`tests/property/`、`tests/integration/`
  - _Validates: 测试基础设施约束（design.md "测试策略" 节）_

- [x] 2. 实现日期工具 `src/utils/dateUtils.js`
  - [x] 2.1 实现纯函数集合
    - 按 `design.md` "组件与接口 / 2. 后端：日期校验工具" 节实现并导出 `formatYmd`、`getServerToday`、`getRecentDays`、`isYmd`、`isWithinRecentDays`、`buildTransactionDateTime`
    - 在同一模块中实现并导出 `resolveSelectedDate(raw, now = new Date())`：缺省返回 `null`；格式不合法抛 `Error('日期格式不正确。')`；越界抛 `Error('所选日期不在最近 3 天内。')`；合法时返回原值
    - _Validates: Requirements 1.2, 1.3, 1.4, 5.1, 5.2, 5.3, 9.1, 9.2_

  - [x] 2.2 为 `dateUtils` 编写单元测试
    - 文件：`tests/unit/dateUtils.test.js`
    - 用固定日期（如 `2025-01-12T10:30:00`）覆盖 `getRecentDays` / `formatYmd` / `buildTransactionDateTime` 的边界例子
    - 显式覆盖文案严格相等：`'日期格式不正确。'`、`'所选日期不在最近 3 天内。'`
    - _Validates: Requirements 5.2, 5.3_

  - [x] 2.3 Property 1 属性测试
    - 文件：`tests/property/dateUtils.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 1: 对任意 JS Date 实例 now，getRecentDays(now) 返回的数组长度恰好为 3，且第 i 项满足：value 等于 formatYmd(now - i 个自然日)、label 依次为 '今天'/'昨天'/'前天'、shortDate 等于该日期的 MM-DD 形式，并且 value 严格降序排列。`
    - 生成器：`fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })`
    - `numRuns: 100`
    - _Validates: Property 1, Requirements 1.2, 1.3_

  - [x] 2.4 Property 9 属性测试（纯函数维度）
    - 同文件 `tests/property/dateUtils.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 9: 对任意满足 ^\d{4}-\d{2}-\d{2}$ 且能被解析为合法日历日、但不属于 getRecentDays(now) 三个 value 之一的字符串 s，调用 resolveSelectedDate(s, now) 必抛 Error，其 message 严格等于 '所选日期不在最近 3 天内。'；并且通过 HTTP 提交时响应 status === 400 且 body.message 等于该文案，且 score_transactions 表与 settings.current_score 在请求前后保持不变。`
    - 仅校验"抛错 + 文案严格相等"的纯函数侧；HTTP 与 DB 副作用部分由集成测试覆盖
    - 生成器：随机 `now` + 随机偏移 `≥ 3 天前` 或 `> 0 天` 的合法日历日
    - `numRuns: 100`
    - _Validates: Property 9, Requirements 5.1, 5.2_

  - [x] 2.5 Property 10 属性测试（纯函数维度）
    - 同文件 `tests/property/dateUtils.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 10: 对任意不匹配 ^\d{4}-\d{2}-\d{2}$ 的字符串，或匹配该格式但不能被解析为合法日历日（如 2025-02-30、2024-13-01、9999-99-99）的字符串 s，调用 resolveSelectedDate(s, now) 必抛 Error，其 message 严格等于 '日期格式不正确。'；并且通过 HTTP 提交时响应 status === 400 且 body.message 等于该文案，且 score_transactions 表与 settings.current_score 在请求前后保持不变。`
    - 生成器：`fc.string()` filter 掉合法格式 + 显式预设 `['2025-13-01','2025-02-30','abcd-ef-gh','','2025-1-1','9999-99-99']`
    - `numRuns: 100`
    - _Validates: Property 10, Requirements 5.3_

  - [x] 2.6 Property 14 属性测试
    - 同文件 `tests/property/dateUtils.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 14: 对任意时刻 t1、selectedDate s 与时刻 t2，若 s ∈ getRecentDays(t1).value 集合 且 t2 - t1 ≥ 4 天（即 s 已不在 getRecentDays(t2).value 集合 中），则 isWithinRecentDays(s, t2) === false，resolveSelectedDate(s, t2) 抛 '所选日期不在最近 3 天内。'。`
    - 生成器：`fc.date()` 生成 `t1`，再生成 `Δ ≥ 4 天` 得到 `t2`
    - `numRuns: 100`
    - _Validates: Property 14, Requirements 9.1, 9.2_

- [x] 3. 扩展 `src/services/scoreService.js`
  - [x] 3.1 改造 `createScoreTransaction` 支持 `selectedDate`
    - 解构入参追加 `selectedDate = null`
    - 当 `selectedDate` 非空时使用 `buildTransactionDateTime(selectedDate, new Date())` 计算 `createdAt` 的 JS `Date`，否则置 `null`
    - 把 `INSERT` 改为：`INSERT INTO score_transactions (type, points_delta, reason, source, quick_item_id, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`，参数末尾追加 `createdAt`
    - 不重算任何已存在记录的 `balance_after`
    - _Validates: Requirements 6.1, 6.2, 6.3, 7.1_

  - [x] 3.2 透传 `selectedDate` 到 `applyQuickItem` 与 `applyManualScore`
    - `applyQuickItem(id, options = {})`：把 `options.selectedDate` 透传给 `createScoreTransaction`
    - `applyManualScore(pointsDelta, reason, options = {})`：把 `options.selectedDate` 透传给 `createScoreTransaction`
    - `adjustScore(targetScore, reason)` 签名与实现保持不变，仍直接写 `CURRENT_TIMESTAMP`
    - _Validates: Requirements 2.2, 3.2, 4.1_

  - [x] 3.3 Property 5 属性测试
    - 文件：`tests/property/scoreService.property.test.js`（连接测试库 `xiaoyue_jifen_test_*`，`beforeEach` 重置 `settings.current_score = 0` 并 `TRUNCATE score_transactions`）
    - 注释：`// Feature: recent-days-score-selection, Property 5: 对任意 source ∈ {quick, manual} 的请求与 getRecentDays(now) 内任一 value 作为 selectedDate 的输入，调用相应 API 成功后查询写入的流水，DATE(created_at) 必须等于 selectedDate。`
    - 生成器：`fc.constantFrom(...recentDays.map(d=>d.value))` × `fc.integer({ min: -1000, max: 1000 }).filter(n => n !== 0)`
    - `numRuns: 100`
    - _Validates: Property 5, Requirements 2.2, 3.2, 7.1_

  - [x] 3.4 Property 6 属性测试
    - 同文件 `tests/property/scoreService.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 6: 对任意 source ∈ {quick, manual} 的请求，当请求体中不含 selectedDate 或其值为空字符串时，调用相应 API 成功后写入的流水 DATE(created_at) 必须等于服务端处理该请求时刻的 Server_Today。`
    - 生成器：`fc.constantFrom(undefined, null, '')` × 合法 `pointsDelta`
    - `numRuns: 100`
    - _Validates: Property 6, Requirements 2.3, 3.3_

  - [x] 3.5 Property 11 属性测试
    - 同文件 `tests/property/scoreService.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 11: 对任意起始 current_score = S0 与任意有限的 (selectedDate, pointsDelta) 序列（其中 selectedDate 全部合法、pointsDelta 全部合法），按顺序提交 /score/quick/:id 或 /score/manual 之后：settings.current_score = S0 + Σ pointsDelta_i；第 k 笔流水的 balance_after = S0 + Σ_{i ≤ k} pointsDelta_i，与 selectedDate 的取值（包括是否早于已存在流水）无关。`
    - 生成器：`fc.array(fc.tuple(recentDateArb, fc.integer({ min: -1000, max: 1000 }).filter(n => n !== 0)), { minLength: 0, maxLength: 50 })`，外加 `fc.integer()` 作为 S0
    - `numRuns: 100`
    - _Validates: Property 11, Requirements 6.1, 6.2_

  - [x] 3.6 Property 12 属性测试
    - 同文件 `tests/property/scoreService.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 12: 对任意已写入流水序列 T = [t_1, …, t_n] 与任意后续合法操作（含 selectedDate 早于 t_n.created_at 的流水），新操作完成后对所有 i ∈ [1, n]：t_i.balance_after 与 t_i.created_at 保持不变。`
    - 在测试中先写入随机长度的初始序列并快照所有 `(id, balance_after, created_at)`，再写入新一批含早于上一批的流水，断言旧记录 snapshot 不变
    - `numRuns: 100`
    - _Validates: Property 12, Requirements 6.3_

  - [x] 3.7 Property 13 属性测试
    - 文件：`tests/property/stats.property.test.js`（同样连接测试库并清表）
    - 注释：`// Feature: recent-days-score-selection, Property 13: 对任意由若干 (selectedDate, pointsDelta) 写入产生的流水集合，对任意 days ∈ [1, 90]，getTransactionStats(days).daily 中 day = D 的桶的 add_points / subtract_points / net_points 必须等于所有 selectedDate = D 且 D 落在最近 days 天窗口内的流水按符号汇总的结果；尤其当某笔流水的 selectedDate = '昨天' 或 '前天' 时，它必须出现在该日的桶里、而不是 Server_Today 的桶里。`
    - 把 `getTransactionStats` 的 `days` 从 fast-check 中抽样（`fc.integer({ min: 1, max: 90 })`）
    - `numRuns: 100`
    - _Validates: Property 13, Requirements 7.2, 7.3_

- [-] 4. Checkpoint - 后端纯逻辑通关
  - 运行 `npm test`，确保 dateUtils 与 scoreService 相关的所有单元/属性测试通过；如有问题向用户确认。

- [ ] 5. 改造路由层 `src/routes/pages.js`
  - [~] 5.1 改造 `POST /score/quick/:id`
    - 在 handler 起始处用 `resolveSelectedDate(req.body.selectedDate)` 解析（位于 `try` 内，抛错由现有 `catch` 走 400/flash 分支）
    - 把解析结果以 `{ selectedDate }` 选项透传给 `applyQuickItem`
    - 错误响应文案严格等于 `'日期格式不正确。'` / `'所选日期不在最近 3 天内。'`
    - _Validates: Requirements 2.1, 2.2, 2.3, 5.1, 5.2, 5.3, 9.1, 9.2_

  - [~] 5.2 改造 `POST /score/manual`
    - 同 5.1 方式解析并透传 `selectedDate` 给 `applyManualScore(pointsDelta, reason, { selectedDate })`
    - 保持原有 `pointsDelta` 与 `reason` 校验顺序：先校验 `selectedDate`，再校验业务字段（与 design "校验顺序" 一致）
    - _Validates: Requirements 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 9.1, 9.2_

  - [~] 5.3 确认 `POST /score/adjust` 不读取 `selectedDate`
    - 不调用 `resolveSelectedDate`、不向 `adjustScore` 传任何日期
    - 行为与现有实现保持一致：`adjustScore` 内部继续写 `CURRENT_TIMESTAMP`
    - _Validates: Requirements 4.1_

  - [~] 5.4 路由 HTTP 校验单元测试
    - 文件：`tests/unit/routes-validation.test.js`（用 `supertest` 套在 Express app 上；mock `scoreService` 防止 DB 副作用）
    - 覆盖：`/score/quick/:id` 与 `/score/manual` 在 `selectedDate` 缺失 / 空串 / 非法格式 / 越界 时的 HTTP 状态码与响应体文案
    - 显式断言越界请求与格式错误请求 **未** 调用 `applyQuickItem` / `applyManualScore`
    - _Validates: Requirements 5.2, 5.3, 9.2_

  - [~] 5.5 Property 8 属性测试
    - 文件：`tests/property/adjust.property.test.js`（连接测试库）
    - 注释：`// Feature: recent-days-score-selection, Property 8: 对任意 selectedDate（包括 null、最近 3 天中任一值、格式非法值、越界值），通过 /score/adjust 写入的流水必有 DATE(created_at) = Server_Today，且响应的成功/失败仅由 targetScore 与 reason 的合法性决定，不受 selectedDate 影响。`
    - 生成器：`selectedDate ∈ {null, 合法 recent, '2025-13-40', '2099-01-01', ''}` × `targetScore ∈ fc.integer()`
    - `numRuns: 100`
    - _Validates: Property 8, Requirements 4.1_

- [ ] 6. 改造首页 SSR 与 `index.ejs`
  - [~] 6.1 在 `GET /` 中注入 `recentDays` locals
    - 在 `pages.js` 的 `GET '/'` 处调用 `getRecentDays(new Date())`，把结果作为 `recentDays` 传给 `res.render('index', { ... })`
    - _Validates: Requirements 1.1, 1.2, 1.3, 1.4, 9.1_

  - [~] 6.2 在 `src/views/index.ejs` 添加 Date_Selector DOM 与提示文案
    - 在 `score-panel` 与 `action-card` 之间插入 `design.md` 给出的 `<section class="card date-selector-card">…</section>`，使用 `recentDays` 渲染三个 `.date-chip`
    - 给"手动记录"表单的 `<section>` 不做额外标记（默认参与日期注入）
    - 给"设置总积分"表单加 `data-include-selected-date="0"`，并在表单内追加 `<p class="form-hint">设置总积分始终记在今天。</p>`
    - 在页面底部 `<script src="/app-actions.js"></script>` 之前引入 `<script src="/date-selector.js"></script>`
    - _Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 4.2, 8.2_

  - [~] 6.3 EJS 渲染 DOM 单元测试
    - 文件：`tests/unit/dom-render.test.js`（jsdom 环境）
    - 用固定 `recentDays` 渲染 `index.ejs`，断言：
      - `[data-date-selector]` 存在且包含 3 个 `.date-chip`（覆盖 1.1）
      - 第一个 chip 的 `aria-checked === 'true'` 且 `data-date-value` 等于 `recentDays[0].value`（覆盖 1.4）
      - HTML 字符串包含 `'设置总积分始终记在今天。'`（覆盖 4.2）
      - "设置总积分"表单标签属性 `data-include-selected-date === '0'`
    - _Validates: Requirements 1.1, 1.4, 4.2_

- [ ] 7. 前端脚本：`public/date-selector.js` 与 `public/app-actions.js` 改造
  - [~] 7.1 新建 `public/date-selector.js`
    - 维护 `currentSelectedDate`，默认为初始 `aria-checked="true"` 的 chip 的 `data-date-value`
    - 监听点击、`Enter`、`Space`、左右方向键，切换时同步更新所有 chip 的 `aria-checked` 与 `.active` 类，使被激活项唯一
    - 暴露 `window.__dateSelector = { getSelectedDate() }` 给 `app-actions.js` 读取
    - 不读取/写入 `localStorage`
    - _Validates: Requirements 1.5, 8.2_

  - [~] 7.2 修改 `public/app-actions.js` 在表单提交时注入 `selectedDate`
    - 在 `fetch` 之前：若页面存在 `[data-date-selector]` 且当前 form 未设置 `data-include-selected-date="0"`，把当前选中的 `data-date-value` 通过 `URLSearchParams.set('selectedDate', value)` 写入请求体
    - 不修改"设置总积分"表单的提交体（其 `data-include-selected-date="0"`）
    - 成功响应后不修改 Date_Selector 的选中状态（覆盖 Requirement 2.4）
    - _Validates: Requirements 2.1, 2.4, 3.1, 4.1_

  - [~] 7.3 在 `index.ejs` 引入 `date-selector.js`
    - 在 6.2 中已引入，本任务作为显式确认引入顺序：`date-selector.js` 在 `app-actions.js` 之前加载
    - _Validates: Requirements 1.5, 2.1, 3.1_

  - [~] 7.4 Property 2 属性测试
    - 文件：`tests/property/dateSelector.property.test.js`（jsdom 环境）
    - 注释：`// Feature: recent-days-score-selection, Property 2: 对任意 recentDays 列表，渲染后的 Date_Selector 中恰好一个 chip 的 aria-checked 为 true，且其 data-date-value 等于 recentDays[0].value。`
    - 生成器：随机长度为 3 的 `recentDays`（用 `getRecentDays(fc.date())` 提供）
    - `numRuns: 100`
    - _Validates: Property 2, Requirements 1.4_

  - [~] 7.5 Property 3 属性测试
    - 同文件 `tests/property/dateSelector.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 3: 对任意由用户操作产生的"点击 chip / 用方向键聚焦并按下 Enter / Space"事件序列，事件处理结束后 Date_Selector 中所有 chip 的 aria-checked 属性恰有一个为 'true'，其余均为 'false'，且为 'true' 的那一项就是最后一次被激活的 chip。`
    - 生成器：`fc.array(fc.constantFrom('click:0','click:1','click:2','arrow-left','arrow-right','enter','space'), { minLength: 0, maxLength: 30 })`
    - `numRuns: 100`
    - _Validates: Property 3, Requirements 1.5, 8.2_

  - [~] 7.6 Property 4 属性测试
    - 同文件 `tests/property/dateSelector.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 4: 对任意标记为 async-score-form 且未设置 data-include-selected-date="0" 的表单，在 Date_Selector 存在时由 app-actions.js 发出的 fetch 请求体里必须含有键 selectedDate，其值等于当时 aria-checked='true' 的 chip 的 data-date-value。`
    - mock `window.fetch`，断言被捕获的 `body` 中含 `selectedDate=<value>` 且与当前选中态一致
    - `numRuns: 100`
    - _Validates: Property 4, Requirements 2.1, 3.1_

  - [~] 7.7 Property 7 属性测试
    - 同文件 `tests/property/dateSelector.property.test.js`
    - 注释：`// Feature: recent-days-score-selection, Property 7: 对任意在 Date_Selector 上选定的 selectedDate 与任意启用中的快捷项，提交 /score/quick/:id 并成功（HTTP 2xx 且 ok: true）之后，Date_Selector 中 aria-checked='true' 的 chip 仍是同一个，data-date-value 仍等于提交时的 selectedDate。`
    - mock `window.fetch` 返回 `{ ok: true, currentScore: ... }`，断言提交前后 `aria-checked='true'` 的 chip `data-date-value` 不变
    - `numRuns: 100`
    - _Validates: Property 7, Requirements 2.4_

  - [~] 7.8 DOM 与 CSS 单元测试（覆盖 8.1 / 8.3）
    - 文件：`tests/unit/dom-render.test.js`（追加 case，jsdom 环境）
    - 加载 `public/styles.css` 内容（fs 读文件），断言其中存在选择器 `.date-chip` 的 `min-height` 数值 `≥ 40px`，并存在 `.date-chip:focus-visible { outline: ... }` 规则
    - _Validates: Requirements 8.1, 8.3_

- [~] 8. 追加样式 `public/styles.css`
  - 把 `design.md` "组件与接口 / 6. 样式" 节列出的 `.date-selector-card` / `.date-selector-head` / `.date-selector` / `.date-chip`（含 `:focus-visible` 与 `.active`）/ `.date-chip-label` / `.date-chip-date` 以及 `@media (max-width: 460px)` 内的覆盖原样追加到 `public/styles.css` 末尾
  - 不修改既有规则，避免影响其它页面样式
  - _Validates: Requirements 8.1, 8.2, 8.3_

- [ ] 9. 端到端集成测试
  - [~] 9.1 Score-flow 集成测试
    - 文件：`tests/integration/score-flow.test.js`
    - 用 `supertest` 拼出三个真实流程：合法 `selectedDate=昨天` 的快捷加分、合法 `selectedDate=前天` 的手动记录、`selectedDate` 越界的快捷加分被拒
    - 断言写入数据库后的 `DATE(created_at)` 与 Selected_Date 一致；越界请求 0 副作用
    - 同时覆盖 `getTransactionStats(7).daily` 中昨天/前天桶的 `add_points/subtract_points/net_points`
    - _Validates: Property 5, Property 6, Property 9, Property 13, Requirements 2.2, 3.2, 5.2, 7.2, 7.3_

- [~] 10. Final checkpoint - 全量测试通过
  - 运行 `npm test`，确保所有单元、属性、集成测试通过；如有问题向用户确认。

## 备注

- 标记 `*` 的子任务为可选，可在 MVP 中跳过；不带 `*` 的子任务必须实现，否则功能不完整。
- 每条任务都引用了具体需求条款（`Requirements X.Y`）和/或具体属性编号（`Property N`），便于追溯。
- 14 个 Correctness Properties 各对应一个独立 PBT 测试，测试注释与 `design.md` 正文严格一致，最少 `numRuns: 100`。
- 设计标注"不可作为属性测试覆盖"的需求 1.1 / 4.2 / 8.1 / 8.3 由 6.3 与 7.8 的 DOM/CSS 单元测试覆盖。
- Checkpoint 任务（4、10）用于在关键节点做整体验证，提前发现问题。
