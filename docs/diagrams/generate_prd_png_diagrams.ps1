Add-Type -AssemblyName System.Drawing

$outDir = $PSScriptRoot
$navy = [System.Drawing.Color]::FromArgb(15, 78, 160)
$blue = [System.Drawing.Color]::FromArgb(37, 99, 235)
$teal = [System.Drawing.Color]::FromArgb(13, 148, 136)
$green = [System.Drawing.Color]::FromArgb(22, 163, 74)
$violet = [System.Drawing.Color]::FromArgb(124, 58, 237)
$pink = [System.Drawing.Color]::FromArgb(219, 39, 119)
$orange = [System.Drawing.Color]::FromArgb(234, 120, 0)
$amber = [System.Drawing.Color]::FromArgb(217, 119, 6)
$slate = [System.Drawing.Color]::FromArgb(71, 85, 105)
$ink = [System.Drawing.Color]::FromArgb(31, 41, 55)

function New-Canvas([int]$width, [int]$height) {
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $graphics.Clear([System.Drawing.Color]::White)
    return @($bitmap, $graphics)
}

function Add-RoundRect($g, [float]$x, [float]$y, [float]$width, [float]$height, [int]$radius, $fill, $stroke, [float]$strokeWidth = 2) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $width - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $width - $d, $y + $height - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $height - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush($fill)
    $pen = New-Object System.Drawing.Pen($stroke, $strokeWidth)
    $g.FillPath($brush, $path); $g.DrawPath($pen, $path)
    $brush.Dispose(); $pen.Dispose(); $path.Dispose()
}

function Add-Outline($g, [float]$x, [float]$y, [float]$width, [float]$height, $stroke, [bool]$dashed = $false) {
    $pen = New-Object System.Drawing.Pen($stroke, 2)
    if ($dashed) { $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash }
    $g.DrawRectangle($pen, $x, $y, $width, $height)
    $pen.Dispose()
}

function Add-Text($g, [string]$text, [float]$x, [float]$y, [float]$width, [float]$height, [float]$size, [bool]$bold = $false, $color = $null, [string]$align = 'Center') {
    if ($null -eq $color) { $color = $ink }
    $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $font = New-Object System.Drawing.Font('Microsoft YaHei', $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = if ($align -eq 'Left') { [System.Drawing.StringAlignment]::Near } else { [System.Drawing.StringAlignment]::Center }
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $fmt.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
    $fmt.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
    $g.DrawString($text, $font, $brush, (New-Object System.Drawing.RectangleF($x, $y, $width, $height)), $fmt)
    $font.Dispose(); $brush.Dispose(); $fmt.Dispose()
}

function Add-Box($g, [float]$x, [float]$y, [float]$width, [float]$height, [string]$title, [string]$body, $accent, $fill = $null, [float]$titleSize = 23, [float]$bodySize = 17) {
    if ($null -eq $fill) { $fill = [System.Drawing.Color]::FromArgb(250, 252, 255) }
    Add-RoundRect $g $x $y $width $height 13 $fill $accent 2
    Add-Text $g $title ($x + 14) ($y + 10) ($width - 28) 38 $titleSize $true $accent
    if ($body) { Add-Text $g $body ($x + 15) ($y + 52) ($width - 30) ($height - 62) $bodySize $false $ink }
}

function Add-LayerLabel($g, [float]$x, [float]$y, [float]$width, [float]$height, [string]$text, $fill) {
    Add-RoundRect $g $x $y $width $height 16 $fill $fill 1
    Add-Text $g $text ($x + 12) ($y + 18) ($width - 24) ($height - 36) 29 $true ([System.Drawing.Color]::White)
}

function Add-Arrow($g, [float]$x1, [float]$y1, [float]$x2, [float]$y2, $color = $null, [float]$thickness = 4) {
    if ($null -eq $color) { $color = $slate }
    $pen = New-Object System.Drawing.Pen($color, $thickness)
    $pen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(7, 9, $true)
    $g.DrawLine($pen, $x1, $y1, $x2, $y2)
    $pen.Dispose()
}

function Save-Canvas($canvas, [string]$fileName) {
    $canvas[0].Save((Join-Path $outDir $fileName), [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas[1].Dispose(); $canvas[0].Dispose()
}

# 图一：分层架构与建设边界。
$canvas = New-Canvas 3200 2200
$g = $canvas[1]
Add-Text $g '通用工业企业能碳SaaS平台业务架构图（当前原型范围）' 0 24 3200 62 43 $true

Add-LayerLabel $g 40 130 320 260 "展现与交互层`n（用户访问）" $navy
Add-Outline $g 40 130 2630 260 $blue
Add-Box $g 390 160 970 190 '企业 Web 界面（PC 浏览器访问）' '按角色访问能源、碳核算、产品碳、预算与资产页面' $blue ([System.Drawing.Color]::FromArgb(248, 251, 255)) 27 20
Add-Box $g 1400 160 1230 190 '可视化与报告' '数据看板  ·  台账查询  ·  平衡/趋势分析  ·  正式报告与导出' $blue ([System.Drawing.Color]::FromArgb(248, 251, 255)) 27 20

Add-LayerLabel $g 40 440 320 720 "业务应用层`n（核心功能）" $teal
Add-Outline $g 40 440 2630 720 $teal
$groupXs = @(390, 845, 1300, 1755, 2210)
$groupTitles = @('1. 能源监测与分析', '2. 组织碳核算与合规', '3. 供应链与产品碳', '4. 资产运营与策略', '5. 数据管理')
$groupAccents = @($green, $violet, $pink, $violet, $orange)
for ($i = 0; $i -lt 5; $i++) {
    Add-RoundRect $g $groupXs[$i] 475 420 640 14 ([System.Drawing.Color]::FromArgb(253, 254, 255)) $groupAccents[$i] 2
    Add-Text $g $groupTitles[$i] $groupXs[$i] 485 420 40 23 $true $groupAccents[$i]
}

Add-Box $g 405 545 390 105 '能耗查询' '能耗明细、趋势、台账导出' $green
Add-Box $g 405 665 390 105 '能耗指标' '指标体系、深度分析、趋势对比' $green
Add-Box $g 405 785 390 105 '能效对标' '对标分析、排名与差距诊断' $green
Add-Box $g 405 905 390 105 '能流分析' '能流图、损耗分析、能源平衡' $green

Add-Box $g 860 545 390 90 '碳排放预览' '总量、构成、趋势与排行' $violet $null 22 16
Add-Box $g 860 645 390 90 '碳核算清单' '任务、草稿、正式版本与修订' $violet $null 22 16
Add-Box $g 860 745 390 90 '碳核查支撑' '核查材料与正式版本关联' $violet $null 22 16
Add-Box $g 860 845 390 90 '碳排放报告' '报告生成、历史报告与导出' $violet $null 22 16
Add-Box $g 860 945 390 90 '碳排放因子库' '因子分类、查询与维护' $violet $null 22 16

Add-Box $g 1315 545 390 105 '供应商碳数据采集' '供应商数据提交与维护' $pink
Add-Box $g 1315 665 390 105 '产品碳足迹披露' '披露内容关联报告版本' $pink
Add-Box $g 1315 785 390 105 '碳足迹项目与清单' '项目边界、活动数据与因子' $pink
Add-Box $g 1315 905 390 105 '结果、报告与因子库' '核算结果、报告管理与因子维护' $pink

Add-Box $g 1770 545 390 105 '能效平衡与优化' '配置平衡、损耗分析、方案校验' $violet
Add-Box $g 1770 665 390 105 '用能分析与策略推荐' '异常识别、策略库与 AI 建议' $violet
Add-Box $g 1770 785 390 105 '用能与碳排放预算管理' '预算编制、执行跟踪、偏差分析' $violet
Add-Box $g 1770 905 390 105 '碳资产管理' '配额、CCER、绿证折算减排量' $violet

Add-Box $g 2225 545 390 90 '用能单元' '组织、层级、业务类型' $orange $null 22 16
Add-Box $g 2225 645 390 90 '能源品种' '单位与折标参数' $orange $null 22 16
Add-Box $g 2225 745 390 90 '重点设备与设备产出' '设备档案、能耗归属、产出口径' $orange $null 22 16
Add-Box $g 2225 845 390 90 '能源数据' '消费、成本、转换回收与外供' $orange $null 22 16
Add-Box $g 2225 945 390 90 '运营数据' '运营指标与年度/月度数据' $orange $null 22 16

Add-LayerLabel $g 40 1210 320 280 "数据服务层`n（数据中台）" $amber
Add-Outline $g 40 1210 2630 280 $amber
$serviceXs = @(390, 770, 1150, 1530, 1910, 2290)
$services = @(
    @('主数据服务', '用能单元、能源品种、设备与字典'),
    @('数据采集与校验服务', '完整性、逻辑、对象与单位校验'),
    @('版本与快照服务', '正式版本、修订副本、历史追溯'),
    @('数据分析服务', '统计聚合、能流与预算计算'),
    @('报告与导出服务', '报告生成、台账与 CSV 导出'),
    @('权限与审计服务', '角色权限、数据权限、操作审计')
)
for ($i = 0; $i -lt 6; $i++) { Add-Box $g $serviceXs[$i] 1240 350 130 $services[$i][0] $services[$i][1] $amber ([System.Drawing.Color]::FromArgb(255, 251, 235)) 20 15 }
Add-Box $g 390 1390 2250 70 '数据治理' '统一数据口径  |  稳定 ID 关联  |  数据质量校验  |  元数据管理  |  数据生命周期管理' $amber ([System.Drawing.Color]::FromArgb(255, 251, 235)) 21 16

Add-LayerLabel $g 40 1540 320 200 "数据接入层`n（人工填报）" $teal
Add-Outline $g 40 1540 2630 200 $teal
Add-Box $g 390 1570 1100 135 '人工录入' '能源消费、能源成本、转换回收与外供、运营指标、设备产出等' $teal ([System.Drawing.Color]::FromArgb(247, 255, 255)) 25 19
Add-Box $g 1530 1570 1100 135 '文件上传（证明材料）' '核查材料、资产凭证、供应商碳数据、政策与合同等附件' $teal ([System.Drawing.Color]::FromArgb(247, 255, 255)) 25 19

Add-LayerLabel $g 40 1790 320 180 "平台支撑层`n（基础设施）" $navy
Add-Outline $g 40 1790 2630 180 $navy
$supportXs = @(390, 765, 1140, 1515, 1890, 2265)
$support = @('计算资源', '存储资源', '网络资源', '安全防护', '运维监控', '高可用与容灾')
for ($i = 0; $i -lt 6; $i++) { Add-Box $g $supportXs[$i] 1815 340 110 $support[$i] '' $blue ([System.Drawing.Color]::FromArgb(248, 251, 255)) 21 15 }

Add-Box $g 40 2015 2630 105 '平台设计原则' '统一数据口径  |  稳定 ID 关联  |  版本管理  |  权限隔离  |  可追溯审计  |  模块化扩展' $navy ([System.Drawing.Color]::FromArgb(239, 246, 255)) 26 21

Add-Outline $g 2730 440 430 1530 $blue $true
Add-Text $g '当前原型范围' 2760 510 370 56 30 $true $navy
Add-Text $g "✓ 以人工录入为主`n`n✓ 支持证明材料与凭证上传`n`n✓ 以 PC Web 页面为主`n`n✓ 本期不体现外部系统实时接入`n`n✓ 后续可按接口能力扩展" 2780 620 330 640 24 $false $ink 'Left'
Add-Box $g 2770 1390 350 310 '说明' '本图用于描述当前原型已覆盖的业务与数据能力。基础设施、接口、自动采集等内容仅作为平台支撑或后续扩展方向，不表示本期已交付。' $blue ([System.Drawing.Color]::FromArgb(239, 246, 255)) 22 18
Save-Canvas $canvas '业务架构图.png'

# 图二：角色入口、数据对象、计算服务、页面模块与输出成果的横向链路。
$canvas = New-Canvas 3600 2100
$g = $canvas[1]
Add-Text $g '通用工业企业能碳SaaS平台页面交互与数据流图（当前原型范围）' 0 20 3600 60 41 $true
Add-Text $g '面向 PRD 与研发对接：先看页面如何录入与读取数据，再看计算结果如何下游复用' 0 82 3600 34 20 $false $slate

$colXs = @(40, 570, 1100, 1630, 2160, 2690)
$colWidths = @(480, 480, 480, 480, 480, 440)
$headerColors = @($teal, $teal, $navy, $violet, $orange, $green)
$headers = @('① 角色与入口', '② 数据管理页面', '③ 核心数据对象', '④ 计算与版本服务', '⑤ 页面交互模块', '⑥ 输出成果 / 下游复用')
for ($i = 0; $i -lt 6; $i++) {
    Add-RoundRect $g $colXs[$i] 150 $colWidths[$i] 64 12 $headerColors[$i] $headerColors[$i] 1
    Add-Text $g $headers[$i] $colXs[$i] 160 $colWidths[$i] 42 22 $true ([System.Drawing.Color]::White)
    Add-Outline $g $colXs[$i] 230 $colWidths[$i] 1170 $headerColors[$i]
}

$roles = @('能源数据维护人员', '能源管理员', '碳核算人员', '核查与审核人员', '供应链数据人员', '能碳决策人员')
for ($i = 0; $i -lt 6; $i++) { Add-Box $g 75 (280 + $i * 165) 410 120 $roles[$i] '按数据权限进入对应页面' $green ([System.Drawing.Color]::FromArgb(248, 255, 251)) 21 15 }

$management = @(
    @('用能单元', '组织层级与业务类型'), @('能源品种', '单位与折标参数'), @('重点设备与设备产出', '设备档案与产出口径'),
    @('能源数据', '消费、成本、转换回收与外供'), @('运营数据', '运行指标及月度/年度数据'), @('文件上传 / 材料管理', '核查、资产、供应商证明材料')
)
for ($i = 0; $i -lt 6; $i++) { Add-Box $g 605 (280 + $i * 165) 410 120 $management[$i][0] $management[$i][1] $teal ([System.Drawing.Color]::FromArgb(247, 255, 255)) 20 15 }

Add-Box $g 1135 280 410 215 '主数据' "企业 / tenant`n用能单元 energyUnitId`n能源品种 energyTypeId`n重点设备 deviceId`n产品 productId" $blue ([System.Drawing.Color]::FromArgb(248, 251, 255)) 22 16
Add-Box $g 1135 525 410 255 '业务数据' "能源消费记录`n能源成本记录`n转换、回收与外供记录`n设备产出与运营数据" $blue ([System.Drawing.Color]::FromArgb(248, 251, 255)) 22 17
Add-Box $g 1135 810 410 215 '规则与参数' "折标系数、因子参数`n核算边界与计算规则`n预算口径与履约规则" $blue ([System.Drawing.Color]::FromArgb(248, 251, 255)) 22 17
Add-Box $g 1135 1055 410 210 '文件材料' "核查材料、资产凭证`n供应商证明与报告附件`n材料仅作证明，不改写正式结果" $blue ([System.Drawing.Color]::FromArgb(248, 251, 255)) 22 17

$calcs = @(
    @('1. 数据完整性与一致性校验', '必填、单位、关联对象与期间校验'), @('2. 能源分析计算', '综合能耗、指标、对标、能流与平衡'),
    @('3. 碳核算版本服务', '草稿校验 → 确认正式版本 → 发起修订'), @('4. 产品碳与预算计算', '产品足迹结果、预算执行与偏差分析'),
    @('5. 权限与审计服务', '数据权限、文件权限与操作审计')
)
for ($i = 0; $i -lt 5; $i++) { Add-Box $g 1665 (280 + $i * 190) 410 150 $calcs[$i][0] $calcs[$i][1] $violet ([System.Drawing.Color]::FromArgb(250, 247, 255)) 19 15 }

Add-Box $g 2195 280 410 205 'A. 能源监测与分析' "能耗查询、指标、对标、能流分析`n读取能源分析数据集" $orange ([System.Drawing.Color]::FromArgb(255, 251, 235)) 22 17
Add-Box $g 2195 515 410 305 'B. 组织碳核算与合规' "预览、碳核算清单、核查支撑、报告、因子库`n核查材料与报告均绑定 taskId + formalVersion" $orange ([System.Drawing.Color]::FromArgb(255, 251, 235)) 22 16
Add-Box $g 2195 850 410 265 'C. 供应链与产品碳' "供应商数据采集、足迹项目、清单、结果、报告与披露`n披露关联已生成的报告版本" $orange ([System.Drawing.Color]::FromArgb(255, 251, 235)) 22 16
Add-Box $g 2195 1145 410 120 'D. 资产运营与策略' '平衡优化、策略推荐、预算与碳资产台账' $orange ([System.Drawing.Color]::FromArgb(255, 251, 235)) 22 16

$outputs = @('看板图表', '分析台账', '指标与对标结果', '能流 / 平衡结果', '正式碳核算结果', '核查证据包', '正式碳排放报告', '预算执行结果', '碳资产台账 / 履约跟踪')
for ($i = 0; $i -lt 9; $i++) { Add-Box $g 2730 (270 + $i * 110) 360 80 $outputs[$i] '' $green ([System.Drawing.Color]::FromArgb(248, 255, 251)) 19 14 }

Add-Arrow $g 485 560 605 560 $green
Add-Arrow $g 1015 560 1135 560 $teal
Add-Arrow $g 1545 680 1665 680 $blue
Add-Arrow $g 2075 680 2195 680 $violet
Add-Arrow $g 2605 680 2730 680 $orange
Add-Text $g '录入 / 维护 / 上传' 520 1410 500 35 20 $true $teal
Add-Text $g '校验 / 聚合 / 计算' 1100 1410 1000 35 20 $true $blue
Add-Text $g '结果输出 / 下游复用' 2180 1410 900 35 20 $true $orange

Add-Outline $g 3160 230 390 1170 $blue $true
Add-Text $g '当前建设边界' 3190 300 330 48 27 $true $navy
Add-Text $g "✓ 人工填报与文件上传为主`n`n✓ 当前以 PC Web 页面使用为主`n`n✓ 不体现 IoT / ERP / DCS / MES 实时接入`n`n✓ 正式版本、证据材料与报告需可追溯`n`n✓ 预留后续接口扩展能力" 3210 400 300 650 21 $false $ink 'Left'
Add-Box $g 3205 1130 300 190 '图示约定' '蓝色：数据对象与校验；紫色：计算和版本；橙色：页面读取与生成；绿色：输出复用。' $blue ([System.Drawing.Color]::FromArgb(239, 246, 255)) 20 16

Add-Box $g 40 1500 3510 180 '关键数据流与交互说明' "1. 数据管理页面维护主数据与业务数据，并将文件材料挂接到对应业务对象。    2. 计算服务对对象、期间、单位和完整性校验后生成分析结果或正式版本。    3. 页面模块只读取匹配权限和条件的数据；报告、核查材料与历史记录保留其绑定版本。    4. 输出成果供查询、分析、预算、履约与对外交付复用。" $navy ([System.Drawing.Color]::FromArgb(248, 251, 255)) 24 18
Add-Box $g 40 1720 600 240 '研发重点 1：主数据稳定关联' '所有业务记录通过稳定 ID 关联对象；名称变更不应断开历史记录。' $green ([System.Drawing.Color]::FromArgb(248, 255, 251)) 21 17
Add-Box $g 675 1720 600 240 '研发重点 2：能源数据真实期间' '未上报月份不补 0；年度补录不自动拆分到月度。' $teal ([System.Drawing.Color]::FromArgb(247, 255, 255)) 21 17
Add-Box $g 1310 1720 600 240 '研发重点 3：碳核算正式版本' '草稿经校验后确认正式；修订生成新版本，不覆盖历史交付。' $violet ([System.Drawing.Color]::FromArgb(250, 247, 255)) 21 17
Add-Box $g 1945 1720 600 240 '研发重点 4：材料与报告可追溯' '核查材料、资产凭证和报告应保留其对应业务对象及版本标识。' $orange ([System.Drawing.Color]::FromArgb(255, 251, 235)) 21 17
Add-Box $g 2580 1720 600 240 '研发重点 5：预算与资产应用' '预算读取既定数据口径；资产台账记录凭证和可用状态。' $amber ([System.Drawing.Color]::FromArgb(255, 251, 235)) 21 17
Save-Canvas $canvas '数据流向图.png'
