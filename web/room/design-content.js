// Concept design content for 迟庭. Source notes and stage boundaries:
// public/docs/住宅设计交付体系.md. Shared geometry is supplied by the house model.

export const DESIGN_CHAPTERS = [
  {
    id: 'tea',
    title: { zh: '茶与独处', en: 'Tea & solitude' },
    kicker: { zh: '重点深化 · 起居茶室', en: 'IN FOCUS · THE TEA ROOM' },
    summary: { zh: '水有去处，物有归处，人可以安心坐下。', en: 'Water has a route, belongings have a home, and you can simply sit.' },
    deliverables: { zh: ['茶席与备水清洗回路', '听音、灯光、插座与收纳', '同一面庭院墙的内外对照'], en: ['Tea setting, preparation and cleanup', 'Listening, lighting, outlets and storage', 'Both sides of the same courtyard wall'] },
  },
  {
    id: 'estate',
    title: { zh: '园居总图', en: 'House & garden' },
    kicker: { zh: '扩展研究 · 一个可以生活的园子', en: 'EXPANSION STUDY · A GARDEN TO LIVE IN' },
    summary: { zh: '日常留在主宅，热闹与运动在花园的另一端。', en: 'Daily life stays in the house; film and movement have a place across the garden.' },
    deliverables: { zh: ['主宅、画室与运动影音翼', '泳池、步行与家务后台', '树种、季相与分期'], en: ['The house, art studio and recreation wing', 'Pool, walking routes and practical support', 'Trees, seasons and phasing'] },
  },
  {
    id: 'inhabitant',
    title: { zh: '使用者', en: 'Inhabitant' },
    kicker: { zh: '01 · 生活简报', en: '01 · Living brief' },
    summary: { zh: '研究有一扇能关上的门，生活有一处可以离开屏幕的座位。', en: 'A door for focused research; a seat for time away from screens.' },
    deliverables: { zh: ['阅读、研究与日常物件清单', '独居、来客与未来变化', '安静、独处与共同生活的边界'], en: ['Reading, research and everyday belongings', 'Living alone, hosting and future change', 'Boundaries for quiet, solitude and shared life'] },
  },
  {
    id: 'coordination',
    title: { zh: '空间协调', en: 'Spatial coordination' },
    kicker: { zh: '02 · 同一座房子', en: '02 · One coherent home' },
    summary: { zh: '平面、门窗、家具与观看方向来自同一份空间资料。', en: 'Plans, openings, furniture and viewpoints share one spatial record.' },
    deliverables: { zh: ['门窗位置与开启方向', '家具占位与主要通路', '影像视点与版本索引'], en: ['Opening positions and door swings', 'Furniture footprints and main routes', 'Viewpoints and drawing revisions'] },
  },
  {
    id: 'sections',
    title: { zh: '立面剖面', en: 'Elevations & sections' },
    kicker: { zh: '03 · 从地面到屋檐', en: '03 · From floor to eaves' },
    summary: { zh: '把窗台、柜体、视线和空间高度放在一起研究。', en: 'Study sill heights, joinery, sightlines and room heights together.' },
    deliverables: { zh: ['公共区与庭院连续剖面', '书墙、茶柜和书桌立面', '床柜、餐厨与湿区关系'], en: ['A continuous living–courtyard section', 'Book wall, tea cabinet and desk elevations', 'Bed, storage, kitchen and wet-area relationships'] },
  },
  {
    id: 'materials',
    title: { zh: '材料细部', en: 'Materials & details' },
    kicker: { zh: '04 · 触感与时间', en: '04 · Touch and time' },
    summary: { zh: '少量连续的材料，允许清洁、修补与自然变旧。', en: 'A restrained palette that can be cleaned, repaired and allowed to age.' },
    deliverables: { zh: ['材料编号与应用位置', '干湿分区和收口方向', '实物样板与维护记录'], en: ['Material codes and applications', 'Dry/wet transitions and joint directions', 'Physical samples and maintenance notes'] },
  },
  {
    id: 'systems',
    title: { zh: '灯光设备', en: 'Light & services' },
    kicker: { zh: '05 · 看得见的光，藏得住的设备', en: '05 · Light and the systems behind it' },
    summary: { zh: '工作、泡茶、清洁和夜归各有需要；设备也需要散热和检修。', en: 'Work, tea, cleaning and late arrivals need different light; equipment needs ventilation and access.' },
    deliverables: { zh: ['四种生活照明策略', '供电、网络与声音分区', '通风、遮光和检修位置'], en: ['Four lighting strategies for daily life', 'Power, data and sound zones', 'Ventilation, blackout and maintenance access'] },
  },
  {
    id: 'furnishing',
    title: { zh: '家具收纳', en: 'Furniture & storage' },
    kicker: { zh: '06 · 物件各得其所', en: '06 · A place for belongings' },
    summary: { zh: '先决定每天拿取什么、放回哪里，再决定做多少柜子。', en: 'Decide what is used and where it returns before adding more cabinetry.' },
    deliverables: { zh: ['家具尺寸与可替换关系', '在读、归档与日常收纳', '柜门展开与清洁路径'], en: ['Furniture dimensions and replaceability', 'Current reading, archives and everyday storage', 'Cabinet clearances and cleaning routes'] },
  },
  {
    id: 'scenarios',
    title: { zh: '生活脚本', en: 'Daily scenarios' },
    kicker: { zh: '07 · 把一天走一遍', en: '07 · Walk through a day' },
    summary: { zh: '从进门到睡前，让真实的动作检验每个空间。', en: 'Let everyday actions test each space, from arriving home to going to bed.' },
    deliverables: { zh: ['归家、工作与离屏', '茶、音乐和朋友来访', '洗晒、清洁与睡前归位'], en: ['Arrival, focused work and screen-free time', 'Tea, music and visiting friends', 'Laundry, cleaning and the evening reset'] },
  },
  {
    id: 'delivery',
    title: { zh: '交付深化', en: 'Development & delivery' },
    kicker: { zh: '08 · 留给未来的底稿', en: '08 · A brief for the future' },
    summary: { zh: '记录已决定的关系，也把需要基地、预算与专业核实的部分写清楚。', en: 'Record settled relationships and identify what still needs a site, a budget and specialist review.' },
    deliverables: { zh: ['图版、清单与变更记录', '选型优先级和待确认事项', '真实项目的测绘与专业协调'], en: ['Drawings, schedules and change records', 'Selection priorities and open questions', 'Surveys and professional coordination for a real project'] },
  },
];

export const MATERIALS = [
  {
    id: 'oak',
    name: { zh: '浅色橡木', en: 'Light oak' },
    color: '#b18c64',
    use: { zh: '书柜、茶柜、书桌与干区家具', en: 'Bookcases, tea storage, desks and dry-area furniture' },
    care: { zh: '表面可擦拭，常接触部位可局部修补。', en: 'Use a wipeable finish and allow local repairs at frequently touched edges.' },
    spec: { zh: '统一木色与纹理方向；实木、饰面和封边随构造选择。', en: 'Coordinate tone and grain; choose solid wood, veneer and edging to suit each assembly.' },
  },
  {
    id: 'plaster',
    name: { zh: '暖白矿物质感墙面', en: 'Warm mineral wall finish' },
    color: '#e2d9c9',
    use: { zh: '公共区、走廊与卧室的连续背景', en: 'A continuous background in living spaces, the gallery and bedrooms' },
    care: { zh: '先做可清洁与补色样板，保留色号和工艺。', en: 'Test cleaning and touch-ups; retain the colour reference and application method.' },
    spec: { zh: '细哑光、低纹理；实际产品依据基层和环境确定。', en: 'Fine, low-texture matte finish; select the actual system for the substrate and conditions.' },
  },
  {
    id: 'stone',
    name: { zh: '浅灰石质表面', en: 'Pale stone surface' },
    color: '#c3b8a5',
    use: { zh: '茶水操作面、局部台面与地面过渡', en: 'Tea preparation surfaces, selected worktops and floor transitions' },
    care: { zh: '以茶、水和清洁剂试样，核对耐污与修补方式。', en: 'Test with tea, water and cleaning products; confirm stain resistance and repair options.' },
    spec: { zh: '天然石或合适替代材料待选；拼缝和边缘单独深化。', en: 'Natural stone or a suitable alternative remains to be selected; develop joints and edges separately.' },
  },
  {
    id: 'linen',
    name: { zh: '亚麻与织物', en: 'Linen & woven textiles' },
    color: '#c9bea9',
    use: { zh: '窗帘、坐垫与可更换软装', en: 'Curtains, cushions and replaceable soft furnishings' },
    care: { zh: '优先可拆洗部件，按产品说明维护。', en: 'Prefer removable components and follow product care instructions.' },
    spec: { zh: '日间透光与夜间遮光分层；吸声性能需另行核实。', en: 'Separate daylight filtering from blackout layers; acoustic performance needs separate verification.' },
  },
  {
    id: 'tile',
    name: { zh: '哑光陶瓷面', en: 'Matte ceramic surface' },
    color: '#a9a79c',
    use: { zh: '沐浴、洗衣与需要频繁清洁的位置', en: 'Bathing, laundry and frequently cleaned areas' },
    care: { zh: '接缝与排水边便于刷洗，保留替换余料。', en: 'Keep joints and drain edges accessible for cleaning; retain replacement pieces.' },
    spec: { zh: '防滑、防水基层及排水由实际产品与专业设计共同确认。', en: 'Confirm slip resistance, waterproofing and drainage with the selected products and specialist design.' },
  },
  {
    id: 'metal',
    name: { zh: '深色哑光金属', en: 'Dark matte metal' },
    color: '#57564f',
    use: { zh: '少量五金、灯具与家具细部', en: 'Selected hardware, lighting and furniture details' },
    care: { zh: '核对手触痕迹、涂层修补及五金替换方式。', en: 'Check fingerprints, coating repair and hardware replacement.' },
    spec: { zh: '统一可见表面与紧固件；潮湿区域另核对耐腐蚀性。', en: 'Coordinate visible finishes and fixings; verify corrosion resistance in damp areas.' },
  },
];

export const LIGHTING_SCENES = [
  {
    id: 'work',
    name: { zh: '专注工作', en: 'Focused work' },
    strategy: { zh: '书桌独立任务灯与柔和背景光分开控制，避免屏幕反光。', en: 'Control desk lighting separately from soft background light and limit reflections on screens.' },
    zones: { zh: ['书桌', '手边书架', '纸面阅读处'], en: ['Desk', 'Working shelves', 'Paper reading seat'] },
    check: { zh: '用真实显示器、纸页和坐姿试灯，再确定灯具与位置。', en: 'Test fittings and positions with the actual screen, paper and seated posture.' },
  },
  {
    id: 'tea',
    name: { zh: '茶与音乐', en: 'Tea & music' },
    strategy: { zh: '照亮茶水操作面和杯沿，让窗边与座位保持较柔和的光。', en: 'Light the preparation surface and cup edges while keeping the seating and window area soft.' },
    zones: { zh: ['茶柜', '茶席', '听音座位'], en: ['Tea cabinet', 'Tea table', 'Listening seat'] },
    check: { zh: '检查倒水时的影子、眩光和伸手能否控制灯光。', en: 'Check shadows while pouring, glare and whether controls are within reach.' },
  },
  {
    id: 'cleaning',
    name: { zh: '日常清洁', en: 'Everyday cleaning' },
    strategy: { zh: '提供均匀可见的清洁模式，覆盖台面、地面和柜体内部。', en: 'Provide a clear, even cleaning mode for worktops, floors and cabinet interiors.' },
    zones: { zh: ['餐厨', '家务区', '卫浴与收纳'], en: ['Kitchen & dining', 'Utility area', 'Bathrooms & storage'] },
    check: { zh: '查看家具阴影、柜内盲区和湿区灯具适用条件。', en: 'Check furniture shadows, dark storage corners and suitability for wet areas.' },
  },
  {
    id: 'night',
    name: { zh: '夜归与起夜', en: 'Late arrivals & night routes' },
    strategy: { zh: '用低位引导光连接玄关、卧室和卫生间，减少直射眼睛。', en: 'Use low-level guidance between the entrance, bedroom and bathroom without direct light at eye level.' },
    zones: { zh: ['玄关', '内廊', '卧室至卫生间'], en: ['Entrance', 'Gallery', 'Bedroom-to-bathroom route'] },
    check: { zh: '手动开关可达，感应可关闭；现场确认门槛与阴影。', en: 'Keep manual switches reachable and sensors optional; check thresholds and shadows on site.' },
  },
];

export const SERVICES = [
  {
    id: 'research',
    name: { zh: '研究设备与基础设施', en: 'Research equipment & infrastructure' },
    strategy: { zh: '设备位靠近书房，线缆归入独立路径；机柜留散热、除尘与检修位置。', en: 'Keep equipment near the study with organised cable routes and access for cooling, dust removal and maintenance.' },
    check: { zh: '按真实设备清单核对功耗、热量、噪声、供电与数据点，由专业人员确认。', en: 'Use the actual equipment list to review power, heat, noise and data points with appropriate specialists.' },
  },
  {
    id: 'tea-water',
    name: { zh: '茶水与清洁', en: 'Tea water & cleanup' },
    strategy: { zh: '备水、烧水、冲泡和清洁有连续操作面；热水不穿过主要通路。', en: 'Connect filling, boiling, brewing and cleaning on a clear work surface; keep hot water away from main routes.' },
    check: { zh: '水壶放稳，电线避开湿面；废水、茶渣与杯具有归位处。', en: 'Keep the kettle stable and cables away from wet surfaces; provide places for waste water, tea leaves and cups.' },
  },
  {
    id: 'sound',
    name: { zh: '听音与安静分区', en: 'Listening & quiet zones' },
    strategy: { zh: '听音座位与左右音箱共同布置，预留近似对称关系；卧室远离主要声源。', en: 'Arrange the listening seat and speakers together, allowing an approximately balanced setup and separation from bedrooms.' },
    check: { zh: '依据实际设备试摆；声学、隔声和邻里影响需另行核对。', en: 'Trial the actual equipment; verify room acoustics, sound isolation and effects on neighbours separately.' },
  },
  {
    id: 'scent',
    name: { zh: '可选择的气味', en: 'Optional scent' },
    strategy: { zh: '香气装置可移动、可关闭，只在选择的时段与位置使用。', en: 'Keep scent devices movable and switchable, used only where and when desired.' },
    check: { zh: '收纳与清洁按产品要求处理，通风独立考虑，不预设全屋持续扩香。', en: 'Follow product storage and cleaning instructions; plan ventilation separately and avoid continuous whole-house diffusion.' },
  },
  {
    id: 'housekeeping',
    name: { zh: '家务与检修', en: 'Housekeeping & maintenance' },
    strategy: { zh: '洗晒、清洁工具、垃圾与耗材集中归位；设备前方保留取出与维修路径。', en: 'Provide defined places for laundry, tools, waste and supplies, with routes to remove and service equipment.' },
    check: { zh: '检查柜门与电器展开、清洁水源、排水和备用物件容量。', en: 'Check appliance and cabinet clearances, cleaning water, drainage and spare-item storage.' },
  },
  {
    id: 'sleep',
    name: { zh: '睡眠与遮光', en: 'Sleep & blackout' },
    strategy: { zh: '卧室保留可关闭的边界；遮光与日间透光分层，工作设备在门外归位。', en: 'Give the bedroom a closable boundary and separate blackout from daylight filtering; keep work equipment outside.' },
    check: { zh: '核对窗帘边缘漏光、设备指示灯、通风噪声和夜间通路。', en: 'Check light leaks, equipment indicators, ventilation noise and the night route.' },
  },
];

export const LIFE_SCENARIOS = [
  {
    id: 'arrival',
    name: { zh: '傍晚归家', en: 'Coming home' },
    sequence: { zh: ['玄关放包换鞋', '茶柜备水', '窗边坐下'], en: ['Leave bag and shoes at the entrance', 'Prepare water at the tea cabinet', 'Sit by the window'] },
    intent: { zh: '入口先接住日常物件，再把人带向庭院。', en: 'Let the entrance receive everyday belongings before opening towards the courtyard.' },
  },
  {
    id: 'research',
    name: { zh: '研究与写作', en: 'Research & writing' },
    sequence: { zh: ['书房关门', '电脑与纸页并置', '离屏阅读片刻'], en: ['Close the study door', 'Work with screens and paper', 'Take a screen-free reading pause'] },
    intent: { zh: '专注与停顿在同一间书房里都有位置。', en: 'Allow both concentration and pauses within the study.' },
  },
  {
    id: 'tea-music',
    name: { zh: '独处的茶与音乐', en: 'Tea & music alone' },
    sequence: { zh: ['茶柜取杯', '茶席冲泡', '听音座位停留', '杯具清洁归位'], en: ['Take cups from the cabinet', 'Brew at the tea table', 'Stay in the listening seat', 'Clean and return the cups'] },
    intent: { zh: '仪式从容，也有容易完成的收尾。', en: 'Give the ritual an unhurried beginning and an easy ending.' },
  },
  {
    id: 'guests',
    name: { zh: '朋友来访', en: 'Friends visiting' },
    sequence: { zh: ['玄关迎接', '餐桌与茶席相聚', '客卫独立到达', '多用房可留宿'], en: ['Meet at the entrance', 'Gather at the dining and tea tables', 'Reach the guest WC independently', 'Use the flexible room for an overnight stay'] },
    intent: { zh: '来客可以自在活动，主卧仍保有私密边界。', en: 'Let guests move comfortably while preserving the bedroom’s privacy.' },
  },
  {
    id: 'reset',
    name: { zh: '家务与归位', en: 'The everyday reset' },
    sequence: { zh: ['衣物送到家务区', '清洁工具取出', '公共台面清空', '用品回到闭合收纳'], en: ['Take laundry to the utility area', 'Collect cleaning tools', 'Clear shared surfaces', 'Return supplies to closed storage'] },
    intent: { zh: '让简洁依靠顺手的后台，而非持续克制。', en: 'Support a calm home with practical storage and service spaces.' },
  },
  {
    id: 'wind-down',
    name: { zh: '睡前慢下来', en: 'Winding down' },
    sequence: { zh: ['工作物件留在书房', '公共区灯光调低', '沐浴与换衣', '卧室遮光入睡'], en: ['Leave work in the study', 'Lower the living-area light', 'Bathe and change', 'Close the blackout layer for sleep'] },
    intent: { zh: '从工作到睡眠，经过一段逐渐安静的距离。', en: 'Create a gradual transition from work to sleep.' },
  },
];
