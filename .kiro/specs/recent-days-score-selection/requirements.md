# 需求文档

## 概述（Introduction）

当前首页的积分操作（快捷加分、快捷减分、手动记录）只能记录在“当前时刻”，无法补录前一两天的事件。本特性在首页增加一个“最近 3 天”日期选择器，让使用者在执行积分操作前可在 “今天 / 昨天 / 前天” 之间任选一天，所选日期会作为该笔积分流水的发生日期写入数据库，便于补录、复盘和按日统计。

本特性不改变积分计算口径（总积分仍然是所有流水按写入顺序累计的结果），仅扩展积分操作可指定的“发生日期”维度。

## 术语表（Glossary）

- **System**：小月积分应用整体（Express 服务端 + EJS 前端 + 浏览器脚本）的统称。
- **Home_Page**：首页视图，对应 `src/views/index.ejs` 渲染的页面。
- **Date_Selector**：首页新增的日期选择控件，提供最近 3 个自然日的选项。
- **Selectable_Day**：Date_Selector 中可被选择的某一天，取值范围为基于服务端本地日期的“今天、昨天、前天”三个自然日之一。
- **Selected_Date**：使用者在 Date_Selector 中当前选中的那一个 Selectable_Day。
- **Score_Operation**：使用者在 Home_Page 上发起的积分变更操作，包含 Quick_Action 与 Manual_Record 两类。
- **Quick_Action**：通过点击快捷项触发的积分加减操作（POST `/score/quick/:id`）。
- **Manual_Record**：通过“手动记录”表单提交的积分加减操作（POST `/score/manual`）。
- **Adjust_Score**：通过“设置总积分”表单提交的总积分校准操作（POST `/score/adjust`）。
- **Score_Transaction**：写入 `score_transactions` 表的一条积分流水。
- **Transaction_Date**：一条 Score_Transaction 在 `created_at` 列上记录的发生日期（按服务端本地时区取日历日）。
- **Server_Today**：服务端本地时区下的当前自然日。

## 需求（Requirements）

### Requirement 1：首页提供最近 3 天的日期选择器

**User Story:** 作为使用者，我希望在首页看到一个最近 3 天的日期选择器，以便在执行积分操作前选择该笔操作的发生日期。

#### Acceptance Criteria

1. WHEN Home_Page 被加载，THE System SHALL 在 Home_Page 上渲染一个 Date_Selector。
2. THE Date_Selector SHALL 提供且仅提供三个 Selectable_Day 选项，分别对应 Server_Today、Server_Today 减 1 天、Server_Today 减 2 天。
3. THE Date_Selector SHALL 为每个 Selectable_Day 同时展示语义标签（“今天”、“昨天”、“前天”）以及对应的具体日期（格式为 `YYYY-MM-DD` 或 `MM-DD`）。
4. WHEN Home_Page 被加载，THE System SHALL 将 Selected_Date 初始化为 Server_Today。
5. WHEN 使用者点击或切换到某个 Selectable_Day，THE System SHALL 将 Selected_Date 更新为该 Selectable_Day 并在 Date_Selector 上以视觉高亮的方式标识当前选中项。

### Requirement 2：日期选择影响首页的快捷加减分操作

**User Story:** 作为使用者，我希望选择某一天后再点击快捷项，所产生的积分流水就记在那一天，以便补录前两天发生的事情。

#### Acceptance Criteria

1. WHEN 使用者在 Home_Page 上提交一次 Quick_Action，THE System SHALL 在请求体中携带当前的 Selected_Date。
2. WHEN 服务端收到一次 Quick_Action 请求，THE System SHALL 将该请求生成的 Score_Transaction 的 Transaction_Date 写入为请求中的 Selected_Date。
3. IF 一次 Quick_Action 请求未携带 Selected_Date，THEN THE System SHALL 将该请求生成的 Score_Transaction 的 Transaction_Date 写入为 Server_Today。
4. WHEN 一次 Quick_Action 成功完成，THE System SHALL 保留 Date_Selector 当前的 Selected_Date 不变，便于使用者继续在同一天补录多笔操作。

### Requirement 3：日期选择影响首页的手动记录操作

**User Story:** 作为使用者，我希望使用“手动记录”表单时也能把积分流水补记到最近 3 天的某一天，而不只是今天。

#### Acceptance Criteria

1. WHEN 使用者在 Home_Page 上提交一次 Manual_Record，THE System SHALL 在请求体中携带当前的 Selected_Date。
2. WHEN 服务端收到一次 Manual_Record 请求，THE System SHALL 将该请求生成的 Score_Transaction 的 Transaction_Date 写入为请求中的 Selected_Date。
3. IF 一次 Manual_Record 请求未携带 Selected_Date，THEN THE System SHALL 将该请求生成的 Score_Transaction 的 Transaction_Date 写入为 Server_Today。

### Requirement 4：设置总积分操作不受日期选择影响

**User Story:** 作为使用者，我希望“设置总积分”始终代表当下的校准动作，不会因为我之前选了别的日期而被记到过去。

#### Acceptance Criteria

1. WHEN 使用者在 Home_Page 上提交一次 Adjust_Score，THE System SHALL 将该请求生成的 Score_Transaction 的 Transaction_Date 写入为 Server_Today，与 Date_Selector 的 Selected_Date 无关。
2. THE Home_Page SHALL 在“设置总积分”表单附近以文字说明的方式告知使用者该操作不受 Date_Selector 影响。

### Requirement 5：服务端校验 Selected_Date 的合法性

**User Story:** 作为系统维护者，我希望服务端只接受最近 3 天范围内的日期，避免被绕过前端控件写入任意历史日期。

#### Acceptance Criteria

1. WHEN 服务端收到 Quick_Action 或 Manual_Record 请求，THE System SHALL 校验请求中的 Selected_Date 是否等于 Server_Today、Server_Today 减 1 天或 Server_Today 减 2 天三者之一。
2. IF 请求中的 Selected_Date 不属于上述三个允许值之一，THEN THE System SHALL 拒绝该请求、返回 HTTP 400、不写入任何 Score_Transaction，并在响应体中返回错误信息 `所选日期不在最近 3 天内。`。
3. IF 请求中的 Selected_Date 不符合 `YYYY-MM-DD` 格式或无法被解析为合法日期，THEN THE System SHALL 拒绝该请求、返回 HTTP 400、不写入任何 Score_Transaction，并在响应体中返回错误信息 `日期格式不正确。`。

### Requirement 6：补录流水对当前总积分的影响

**User Story:** 作为使用者，我希望补录前两天的积分操作也会即时反映到当前总积分上，与今天的操作保持一致的计算方式。

#### Acceptance Criteria

1. WHEN 一次 Quick_Action 或 Manual_Record 请求被服务端接受，THE System SHALL 在写入 Score_Transaction 时将 `points_delta` 累加到当前总积分上，行为与未引入 Date_Selector 时完全一致。
2. WHEN 一次 Quick_Action 或 Manual_Record 请求被服务端接受，THE System SHALL 将该笔 Score_Transaction 的 `balance_after` 写入为应用本次 `points_delta` 之后的当前总积分值。
3. THE System SHALL 不重新计算或修改任何已存在 Score_Transaction 的 `balance_after`，无论新写入流水的 Transaction_Date 是否早于这些已存在流水的 Transaction_Date。

### Requirement 7：Transaction_Date 在流水与统计中的展示一致性

**User Story:** 作为使用者，我希望补录到过去某一天的流水在“积分流水”页面和按日统计中，都按我选择的那一天来归类。

#### Acceptance Criteria

1. WHEN 积分流水页（`/transactions`）被渲染，THE System SHALL 按 Score_Transaction 的 Transaction_Date（即 `created_at` 的日期部分）展示该笔流水所属的日期。
2. WHEN 积分流水页计算按日统计（`getTransactionStats` 返回的 `daily` 字段），THE System SHALL 把每条 Score_Transaction 归入其 Transaction_Date 对应的那一天。
3. THE System SHALL 保证一笔由 Selected_Date = 昨天 / 前天 触发写入的 Score_Transaction，在按日统计中计入该 Selected_Date 当天，而不是 Server_Today。

### Requirement 8：Date_Selector 的可访问性与移动端适配

**User Story:** 作为手机端使用者，我希望日期选择器在小屏幕上易点、易读，并且能用键盘和读屏软件正常使用。

#### Acceptance Criteria

1. THE Date_Selector SHALL 在视口宽度不大于 480 像素时仍然完整显示三个 Selectable_Day 的标签和日期，且任一可点击区域的最短边不小于 40 像素。
2. THE Date_Selector SHALL 为当前 Selected_Day 设置可被读屏软件识别的选中状态（例如 `aria-pressed="true"` 或同等语义的属性）。
3. WHEN 使用者通过键盘聚焦到 Date_Selector 的任一选项，THE System SHALL 显示可见的焦点指示样式。

### Requirement 9：跨日切换时 Date_Selector 的自适应

**User Story:** 作为使用者，我希望页面停留过夜后，日期选择器展示的“今天 / 昨天 / 前天”仍然准确。

#### Acceptance Criteria

1. WHEN 使用者再次提交任一 Score_Operation，THE System SHALL 以提交时刻的 Server_Today 为基准重新判定允许的三个 Selectable_Day。
2. IF Home_Page 在浏览器中已打开但其 Date_Selector 中曾经的 Selected_Date 因服务端日期推进已不再属于最近 3 天，THEN THE System SHALL 在下一次提交该 Date_Selector 上的 Score_Operation 时按 Requirement 5 的规则拒绝并提示，且不写入任何 Score_Transaction。
