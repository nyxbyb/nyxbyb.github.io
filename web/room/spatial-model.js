/**
 * 唯一空间模型 / Single spatial source for plans, elevations and camera studies.
 * Metres; origin = north-west control-line corner. x increases east, y south,
 * z upwards. North is [0, -1], so north stays at the top of the existing SVG.
 * Existing plan coordinates map directly: SVG x = 140 + 60*x; y = 180 + 60*y.
 * Boundaries are concept control lines, not finished construction clearances.
 */
const label = (zh, en) => ({ zh, en });
const polygon = (x, y, w, d) => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
const zone = (id, zh, en, area, boxes, labelAt, outdoor = false) => ({ id, label: label(zh, en), area, polygons: boxes.map(box => polygon(...box)), labelAt, outdoor });
const zones = [
  zone('living', '起居 · 书与茶', 'Living · books & tea', 40, [[0, 5.6, 10, 3.4], [6, 9, 4, 1.5]], [4.95, 8.25]),
  zone('study', '独立书房', 'Independent study', 14, [[6, 10.5, 4, 3.5]], [8.05, 13.05]),
  zone('bedroom', '主卧', 'Primary bedroom', 17.64, [[0, 0, 4.2, 4.2]], [2.1, 3.43]),
  zone('kitchen', '餐厨', 'Kitchen & dining', 21.6, [[10, 5.6, 4, 5.4]], [11.75, 10.55]),
  zone('flex', '客房 · 多用室', 'Guest · multipurpose', 13.86, [[7, 0, 3.3, 4.2]], [8.65, 2.23]),
  zone('reserve', '画室 · 可变工作间', 'Art studio · adaptable room', 15.54, [[10.3, 0, 3.7, 4.2]], [12.15, 3.35]),
  zone('bath', '两处卫浴', 'Two bathrooms', 11.76, [[4.2, 0, 2.8, 4.2]], [5.6, 1.55]),
  zone('entry', '玄关 · 家务 · 回廊', 'Entry · utility · gallery', 31.6, [[0, 4.2, 14, 1.4], [10, 11, 4, 3]], [11.65, 12.85]),
  zone('garden', '内庭 · 雨与树', 'Courtyard · rain & trees', 30, [[0, 9, 6, 5]], [2.7, 12.98], true)
];

// Separate physical spaces prevent two disconnected polygons sharing a zone id
// from accidentally passing the door-connectivity check.
const spaces = zones.filter(item => !['entry', 'bath'].includes(item.id)).map(item => ({ id: item.id, zoneId: item.id, polygons: item.polygons }));
spaces.push(
  { id: 'gallery', zoneId: 'entry', polygons: [polygon(0, 4.2, 14, 1.4)] },
  { id: 'vestibule', zoneId: 'entry', polygons: [polygon(10, 11, 4, 3)] },
  { id: 'bath-main', zoneId: 'bath', polygons: [polygon(4.2, 0, 2.8, 2.5)] },
  { id: 'bath-wc', zoneId: 'bath', polygons: [polygon(4.2, 2.5, 1.6, 1.7)] },
  { id: 'bath-lobby', zoneId: 'bath', polygons: [polygon(5.8, 2.5, 1.2, 1.7)] }
);

const wall = (id, zh, en, a, b, kind = 'interior') => ({ id, label: label(zh, en), a, b, kind, height: 2.7, thickness: kind === 'exterior' ? .24 : .12 });
// Wall segments are complete. Renderers subtract the attached openings below.
const walls = [
  wall('W01', '北侧外墙', 'North external wall', [0, 0], [14, 0], 'exterior'),
  wall('W02', '西侧外墙', 'West external wall', [0, 0], [0, 9], 'exterior'),
  wall('W03', '庭院北界', 'North courtyard edge', [0, 9], [6, 9], 'exterior'),
  wall('W04', '庭院东界', 'East courtyard edge', [6, 9], [6, 14], 'exterior'),
  wall('W05', '南侧外墙', 'South external wall', [6, 14], [14, 14], 'exterior'),
  wall('W06', '东侧外墙', 'East external wall', [14, 0], [14, 14], 'exterior'),
  wall('W07', '主卧与湿区隔墙', 'Bedroom / wet-core partition', [4.2, 0], [4.2, 4.2]),
  wall('W08', '湿区与客房隔墙', 'Wet-core / guest partition', [7, 0], [7, 4.2]),
  wall('W09', '客房与预留室隔墙', 'Guest / reserve partition', [10.3, 0], [10.3, 4.2]),
  wall('W10', '北房间与回廊隔墙', 'Northern rooms / gallery partition', [0, 4.2], [14, 4.2]),
  wall('W11', '回廊与公共区隔墙', 'Gallery / shared-room partition', [0, 5.6], [14, 5.6]),
  wall('W12', '浴室与前室隔墙', 'Bathroom / lobby partition', [4.2, 2.5], [7, 2.5]),
  wall('W13', '客用洗手间隔墙', 'Guest WC partition', [5.8, 2.5], [5.8, 4.2]),
  wall('W14', '书房北墙', 'Study north partition', [6, 10.5], [10, 10.5]),
  wall('W15', '起居与餐厨界面', 'Living / kitchen edge', [10, 5.6], [10, 10.5]),
  wall('W16', '书房东墙', 'Study east partition', [10, 10.5], [10, 14]),
  wall('W17', '餐厨与玄关隔墙', 'Kitchen / vestibule partition', [10, 11], [14, 11])
];
const opening = (id, zh, en, wallId, type, a, b, spaceIds, options = {}) => ({
  id, label: label(zh, en), wallId, type, a, b, spaceIds,
  connects: [...new Set(spaceIds.map(id => spaces.find(space => space.id === id)?.zoneId || id))],
  sill: 0, head: 2.2, operation: type === 'passage' ? 'open' : 'hinged', ...options
});
const openings = [
  opening('D01', '入户门', 'Entrance door', 'W05', 'door', [12.2, 14], [13.2, 14], ['outside', 'vestibule'], { hinge: 'b', swing: 'north' }),
  opening('D02', '书房门', 'Study door', 'W16', 'door', [10, 12.1], [10, 13.1], ['vestibule', 'study'], { hinge: 'b', swing: 'west' }),
  opening('D03', '主卧门', 'Bedroom door', 'W10', 'door', [3.1, 4.2], [4, 4.2], ['gallery', 'bedroom'], { hinge: 'b', swing: 'north' }),
  opening('D04', '湿区前室门', 'Wet-core lobby door', 'W10', 'door', [5.95, 4.2], [6.85, 4.2], ['gallery', 'bath-lobby'], { hinge: 'b', swing: 'north' }),
  opening('D05', '客房门', 'Guest-room door', 'W10', 'door', [8.85, 4.2], [9.75, 4.2], ['gallery', 'flex'], { hinge: 'b', swing: 'north' }),
  opening('D06', '画室门', 'Art-studio door', 'W10', 'door', [12.7, 4.2], [13.6, 4.2], ['gallery', 'reserve'], { hinge: 'b', swing: 'north' }),
  opening('D07', '完整浴室门', 'Full-bathroom door', 'W12', 'door', [5.95, 2.5], [6.85, 2.5], ['bath-lobby', 'bath-main'], { hinge: 'b', swing: 'north' }),
  opening('D08', '客用洗手间移门', 'Guest WC pocket door', 'W13', 'door', [5.8, 3.0], [5.8, 3.8], ['bath-lobby', 'bath-wc'], { operation: 'pocket', slideTo: 'north' }),
  opening('D09', '庭院单扇旁侧推拉门', 'Courtyard single-leaf side-sliding door', 'W03', 'door', [4.2, 9], [5.4, 9], ['living', 'garden'], { operation: 'sliding', head: 2.5, slideTo: 'west', leafCount: 1, clearWidth: 1.2, parkingSide: 'west', description: label('净开目标1.20m，单扇向西旁侧轨道停放；不是在本1.2m洞内双扇互推。窗前停车、150mm实垛、轨道、密封与实际净开须一并选型核验。', 'Target clear opening 1.20 m: one leaf parks to the west on a side track, rather than two leaves overlapping within this 1.2 m aperture. Verify parking in front of glazing, the 150 mm pier, track, seals and actual clear width together.') }),
  opening('P01', '回廊至起居', 'Gallery to living', 'W11', 'passage', [5.8, 5.6], [7, 5.6], ['gallery', 'living']),
  opening('P02', '回廊至餐厨', 'Gallery to kitchen', 'W11', 'passage', [10.1, 5.6], [11.3, 5.6], ['gallery', 'kitchen']),
  opening('P03', '餐厨至起居', 'Kitchen to living', 'W15', 'passage', [10, 6.1], [10, 7.6], ['kitchen', 'living']),
  opening('P04', '玄关至餐厨', 'Vestibule to kitchen', 'W17', 'passage', [10.1, 11], [11.3, 11], ['vestibule', 'kitchen']),
  opening('V01', '主卧北窗', 'Bedroom north window', 'W01', 'window', [.75, 0], [3.45, 0], ['bedroom', 'outside'], { sill: 1.05, head: 2.5, operation: 'operable' }),
  opening('V02', '浴室高窗', 'Bathroom high window', 'W01', 'window', [4.65, 0], [6.55, 0], ['bath-main', 'outside'], { sill: 1.6, head: 2.5, operation: 'operable-obscure' }),
  opening('V03', '客房北窗', 'Guest north window', 'W01', 'window', [7.5, 0], [9.8, 0], ['flex', 'outside'], { sill: 1.05, head: 2.5, operation: 'operable' }),
  opening('V04', '画室北窗', 'Art-studio north window', 'W01', 'window', [10.85, 0], [13.55, 0], ['reserve', 'outside'], { sill: .95, head: 2.5, operation: 'operable' }),
  opening('V05', '起居西窗', 'Living west window', 'W02', 'window', [0, 5.9], [0, 8.55], ['living', 'outside'], { sill: .45, head: 2.5, operation: 'fixed-plus-operable' }),
  opening('V06', '起居庭院长窗', 'Living courtyard glazing', 'W03', 'window', [.45, 9], [4.05, 9], ['living', 'garden'], { sill: .15, head: 2.5, operation: 'fixed' }),
  opening('V07', '书房庭院窗', 'Study courtyard window', 'W04', 'window', [6, 10.8], [6, 13.5], ['study', 'garden'], { sill: .55, head: 2.5, operation: 'fixed-plus-operable' }),
  opening('V08', '书房南窗', 'Study south window', 'W05', 'window', [6.7, 14], [9.3, 14], ['study', 'outside'], { sill: .95, head: 2.5, operation: 'operable' }),
  opening('V09', '厨房东窗', 'Kitchen east window', 'W06', 'window', [14, 6.2], [14, 9.2], ['kitchen', 'outside'], { sill: 1.1, head: 2.5, operation: 'fixed-plus-operable' })
];

const item = (id, roomId, zh, en, type, rect, height, options = {}) => ({ id, roomId, label: label(zh, en), type, rect: { x: rect[0], y: rect[1], w: rect[2], d: rect[3] }, height, baseHeight: 0, blocking: true, ...options });
// Rectangles are the occupied plan footprints, including dining chairs in use.
// Rugs, loose mats and the sofa-bed's alternate outline are non-blocking.
const furniture = [
  item('F-L01', 'living', '三人亚麻沙发', 'Three-seat linen sofa', 'sofa', [1.25, 6.32, 3.1, .9], .78),
  item('F-L02', 'living', '低茶几', 'Low coffee table', 'table', [2.3, 7.3, 1.4, .8], .36, { shape: 'ellipse' }),
  item('F-L03', 'living', '阅读椅', 'Reading chair', 'chair', [4.9, 6.93, .5, .48], .8, { rotation: 45 }),
  item('F-L04', 'living', '茶桌', 'Tea table', 'tea-table', [7.8, 7.5, 1.2, 1.2], .68, { shape: 'ellipse' }),
  item('F-L05', 'living', '南侧茶椅', 'South tea chair', 'chair', [8.15, 9, .5, .48], .78, { rotation: 180 }),
  item('F-L06', 'living', '西侧茶椅', 'West tea chair', 'chair', [7.15, 7.86, .5, .48], .78, { rotation: 270 }),
  item('F-L07', 'living', '东侧茶椅', 'East tea chair', 'chair', [9.1, 7.86, .5, .48], .78, { rotation: 90 }),
  item('F-L08', 'living', '西段低书柜', 'West low bookcase', 'shelf', [.12, 5.7, 2.06, .36], .85),
  item('F-L09', 'living', '音响与唱片柜', 'Audio and record cabinet', 'shelf', [4.45, 5.7, 1.1, .36], .75),
  item('F-L10', 'living', '洗沏收纳茶水柜', 'Wash / brew / storage tea counter', 'tea-counter', [7.15, 5.7, 2.55, .6], .9),
  item('F-L11', 'living', '左落地音箱', 'Left floor speaker', 'speaker', [1.66, 8.4, .26, .3], .88, { rotation: 180, frontDirection: 'north', toeInTrial: [0, 20] }),
  item('F-L12', 'living', '右落地音箱', 'Right floor speaker', 'speaker', [3.68, 8.4, .26, .3], .88, { rotation: 180, frontDirection: 'north', toeInTrial: [0, 20] }),
  item('F-L13', 'living', '转角阅读矮凳', 'Reading bench in the return', 'bench', [6.14, 9.2, .44, 1.1], .43),
  item('F-L14', 'living', '亚麻地毯', 'Linen rug', 'rug', [1.05, 6.3, 4.45, 2.15], .015, { blocking: false }),
  item('F-L15', 'living', '独立茶洗水槽', 'Dedicated tea sink', 'sink', [7.3, 5.8, .42, .4], .03, { baseHeight: .9, parentId: 'F-L10', blocking: false }),
  item('F-L16', 'living', '沥水托盘', 'Draining tray', 'tray', [7.87, 5.82, .55, .38], .025, { baseHeight: .9, parentId: 'F-L10', blocking: false }),
  item('F-L17', 'living', '柜上定点烧水壶', 'Stationary counter kettle', 'kettle', [8.65, 5.91, .26, .26], .28, { baseHeight: .9, parentId: 'F-L10', blocking: false }),
  item('F-L18', 'living', '洁净续水托盘', 'Clean serving tray', 'tray', [9.12, 5.82, .45, .4], .025, { baseHeight: .9, parentId: 'F-L10', blocking: false }),
  item('F-L19', 'living', '阅读落地灯', 'Reading floor lamp', 'floor-lamp', [4.55, 6.13, .22, .22], 1.5),
  item('F-L20', 'living', '可取出无明火扩香盘', 'Removable flame-free scent tray', 'scent-tray', [.28, 5.78, .42, .2], .025, { baseHeight: .85, parentId: 'F-L08', blocking: false }),
  item('F-L21', 'living', '坐姿干泡茶盘', 'Seated-brewing tray', 'tea-tray', [8.12, 7.9, .48, .32], .025, { baseHeight: .68, parentId: 'F-L04', blocking: false }),
  item('F-L22', 'living', '小型保温续水壶', 'Small insulated server', 'insulated-server', [8.64, 7.76, .16, .16], .24, { baseHeight: .68, parentId: 'F-L04', blocking: false }),
  item('F-L23', 'living', '小废水盂', 'Small tea-waste bowl', 'waste-bowl', [8, 8.23, .18, .18], .1, { baseHeight: .68, parentId: 'F-L04', blocking: false, shape: 'ellipse' }),
  item('F-S01', 'study', '双显示器工作桌', 'Dual-display work desk', 'desk', [6.4, 11.05, 2.1, .8], .74),
  item('F-S02', 'study', '人体工学工作椅', 'Ergonomic work chair', 'chair', [7.25, 11.96, .5, .48], 1.1, { rotation: 180 }),
  item('F-S03', 'study', '北侧书架', 'North bookcase', 'shelf', [7.1, 10.65, 1.8, .33], 2.2),
  item('F-S04', 'study', '通风计算设备柜', 'Ventilated compute cabinet', 'equipment', [9.35, 10.72, .5, 1.1], .8, { detail: label('独立通风、电源与有线网络；柜门向西检修，型号待定。', 'Independent ventilation, power and wired network; service access faces west. Equipment remains undecided.') }),
  item('F-S05', 'study', '南侧矮收纳', 'South low storage', 'shelf', [9.48, 13.3, .37, .5], .8),
  item('F-S06', 'study', '左显示器', 'Left monitor', 'monitor', [6.6, 11.14, .72, .07], .42, { baseHeight: .74, parentId: 'F-S01', blocking: false }),
  item('F-S07', 'study', '右显示器', 'Right monitor', 'monitor', [7.42, 11.14, .72, .07], .42, { baseHeight: .74, parentId: 'F-S01', blocking: false }),
  item('F-B01', 'bedroom', '双人床', 'Double bed', 'bed', [1.5, .85, 1.8, 2], .5, { headDirection: 'north' }),
  item('F-B02', 'bedroom', '床头板', 'Headboard', 'headboard', [1.5, .72, 1.8, .16], .9),
  item('F-B03', 'bedroom', '西侧衣柜', 'West wardrobe', 'wardrobe', [.15, .18, .6, 3.55], 2.5),
  item('F-B04', 'bedroom', '左床头柜', 'Left bedside table', 'table', [1, .86, .36, .42], .46),
  item('F-B05', 'bedroom', '右床头柜', 'Right bedside table', 'table', [3.43, .86, .36, .42], .46),
  item('F-K01', 'kitchen', '北侧操作台', 'North kitchen counter', 'counter', [11.45, 5.76, 2.37, .62], .9),
  item('F-K02', 'kitchen', '东侧水槽台', 'East sink counter', 'counter', [13.18, 6.38, .64, 3.1], .9),
  item('F-K03', 'kitchen', '冰箱', 'Refrigerator', 'equipment', [13.18, 10.1, .64, .7], 1.9),
  item('F-K04', 'kitchen', '四人餐桌', 'Four-seat dining table', 'dining-table', [11.16, 8.2, 1.8, .9], .74),
  ...[[11.4, 7.61], [12.2, 7.61], [11.4, 9.21], [12.2, 9.21]].map(([x, y], i) => item(`F-K0${i + 5}`, 'kitchen', `餐椅${i + 1}`, `Dining chair ${i + 1}`, 'chair', [x, y, .48, .48], .8, { rotation: i > 1 ? 180 : 0 })),
  item('F-K09', 'kitchen', '北台嵌入灶具', 'North counter hob', 'hob', [12.05, 5.84, .75, .44], .03, { baseHeight: .9, parentId: 'F-K01', blocking: false }),
  item('F-K10', 'kitchen', '东台嵌入水槽', 'East counter sink', 'sink', [13.25, 7.43, .5, .65], .03, { baseHeight: .9, parentId: 'F-K02', blocking: false }),
  item('F-F01', 'flex', '客用展开床', 'Guest bed unfolded', 'sofa-bed', [7.35, .5, 1.4, 2], .48, { headDirection: 'north' }),
  item('F-F02', 'flex', '客房收纳', 'Guest storage', 'wardrobe', [9.64, .4, .48, 2.4], 2.4),
  item('F-F03', 'flex', '小书桌', 'Small writing desk', 'desk', [7.18, 3.38, 1.3, .58], .74),
  item('F-F04', 'flex', '客房椅', 'Guest-room chair', 'chair', [7.58, 2.78, .5, .48], .8, { rotation: 180 }),
  item('F-R01', 'reserve', '可洗画材工作台', 'Washable art workbench', 'art-counter', [10.5, .2, 2.9, .65], .9, { provisional: true }),
  item('F-R02', 'reserve', '平面画材抽屉柜', 'Flat art-supply drawers', 'shelf', [10.5, 1.65, .65, 1.95], .8, { provisional: true, openedRect: { x: 11.15, y: 1.65, w: .55, d: 1.95 } }),
  item('F-R03', 'reserve', '画室活动椅', 'Art-studio chair', 'chair', [11.85, 1.05, .5, .48], .8, { rotation: 180, provisional: true }),
  item('F-R04', 'reserve', '独立画架', 'Freestanding easel', 'easel', [11.85, 2.2, .65, .7], 1.75, { provisional: true }),
  item('F-R05', 'reserve', '作品晾干架', 'Artwork drying rack', 'drying-rack', [13.45, 1.25, .35, 1.6], 1.7, { provisional: true }),
  item('F-R06', 'reserve', '独立洗笔盆', 'Dedicated brush-washing sink', 'sink', [12.85, .3, .4, .42], .03, { baseHeight: .9, parentId: 'F-R01', blocking: false }),
  item('F-W01', 'bath', '淋浴区', 'Shower', 'shower', [4.35, .15, 1.3, 1.25], .03, { spaceId: 'bath-main', blocking: false }),
  item('F-W02', 'bath', '浴室台盆', 'Bathroom vanity', 'basin', [4.35, 1.78, 1.1, .52], .85, { spaceId: 'bath-main' }),
  item('F-W03', 'bath', '浴室坐便器', 'Bathroom WC', 'wc', [6.12, .22, .52, .8], .7, { spaceId: 'bath-main' }),
  item('F-W04', 'bath', '客用坐便器', 'Guest WC', 'wc', [4.45, 2.68, .5, .76], .7, { spaceId: 'bath-wc' }),
  item('F-W05', 'bath', '客用洗手盆', 'Guest basin', 'basin', [5.18, 2.68, .43, .36], .85, { spaceId: 'bath-wc' }),
  item('F-E01', 'entry', '洗烘与家务台', 'Laundry / utility counter', 'utility', [12.4, 11.15, 1.4, .72], .9, { spaceId: 'vestibule' }),
  item('F-E02', 'entry', '外衣与清洁柜', 'Coat / cleaning cupboard', 'wardrobe', [13.3, 12.25, .52, 1.5], 2.5, { spaceId: 'vestibule' }),
  item('F-E03', 'entry', '换鞋凳', 'Entry bench', 'bench', [10.18, 13.2, 1.5, .45], .43, { spaceId: 'vestibule' }),
  item('F-E04', 'entry', '入口地垫', 'Entry mat', 'rug', [11.5, 13.33, 1.85, .43], .015, { blocking: false, spaceId: 'vestibule' }),
  item('F-G01', 'garden', '檐下长凳', 'Courtyard bench', 'bench', [1.05, 9.55, 2.25, .42], .43),
  item('F-G02', 'garden', '一棵树', 'A courtyard tree', 'tree', [2.9, 11.4, .2, .2], 4, { canopyRadius: 1.4 }),
  item('F-G03', 'garden', '木平台', 'Timber deck', 'deck', [.45, 9.17, 4.95, 1.1], .02, { blocking: false })
];

const routes = [
  { id: 'R01', label: label('归家 · 放下包 · 工作', 'Arrive · put down a bag · work'), width: .9, rooms: ['entry', 'study'], points: [[12.7, 14.8], [12.7, 14], [12.7, 12.6], [8.7, 12.6]] },
  { id: 'R02', label: label('归家 · 回廊 · 起居 · 入庭', 'Arrive · gallery · living · courtyard'), width: .9, rooms: ['entry', 'kitchen', 'living', 'garden'], points: [[12.7, 12.6], [10.65, 12.6], [10.65, 4.9], [6.4, 4.9], [6.4, 8.5], [4.8, 8.5], [4.8, 10.4]] },
  { id: 'R03', label: label('夜间 · 回廊 · 安睡', 'Evening · gallery · sleep'), width: .75, rooms: ['kitchen', 'entry', 'bedroom'], points: [[10.65, 10.6], [10.65, 4.9], [3.55, 4.9], [3.55, 3.35], [2.5, 3.35]] },
  { id: 'R04', label: label('画室入口 · 画架 · 洗笔台', 'Studio entrance · easel · brush sink'), width: .75, rooms: ['entry', 'reserve'], points: [[13.15, 4.9], [13.15, 3.1], [13, 3.1], [13, 1.3]] }
];

// Horizontal lenses are deliberate: geometric reference views stay undistorted.
const camera = (roomId, position, target, fov = 65) => ({ id: `C-${roomId}`, roomId, position, target, eyeHeight: 1.5, targetHeight: 1.5, fov });
const cameras = [
  camera('living', [9.4, 6.5], [3.2, 7.9], 70),
  camera('study', [9.1, 13.45], [7.4, 11.5]),
  camera('bedroom', [3.05, 3.8], [2.1, 1.5]),
  camera('kitchen', [10.55, 10.65], [12.6, 7.3], 70),
  camera('flex', [8.8, 3.8], [8.2, 1.2]),
  camera('reserve', [13.45, 3.2], [12.5, .6], 75),
  camera('bath', [6.45, 1.45], [4.85, .65], 75),
  camera('entry', [11.3, 12.9], [13.1, 11.65], 70),
  camera('garden', [4.4, 13.7], [3, 9], 78),
  { ...camera('living', [9.55, 10.2], [8.35, 6.8], 75), id: 'C-tea', eyeHeight: 1.25, targetHeight: 1.25, label: label('茶柜与茶席近看', 'Tea counter and table study') }
];

const record = (id, zh, en, descriptionZh, descriptionEn, extra = {}) => ({ id, label: label(zh, en), description: label(descriptionZh, descriptionEn), ...extra });
const box = (x, y, w, d) => ({ x, y, w, d });
const station = (id, zh, en, descriptionZh, descriptionEn, furnitureId, kind) => {
  const f = furniture.find(f => f.id === furnitureId), r = f.rect;
  return record(id, zh, en, descriptionZh, descriptionEn, { furnitureId, kind, position: [r.x + r.w / 2, r.y + r.d / 2, f.baseHeight + f.height], rect: r });
};
const point = (id, zh, en, descriptionZh, descriptionEn, kind, position, specZh, specEn, sceneIds, extra = {}) => record(id, zh, en, descriptionZh, descriptionEn, { kind, position, spec: label(specZh, specEn), sceneIds, ...extra });
const seatPosition = [2.8, 6.8];
const speakerIds = ['F-L11', 'F-L12'];
const speakerCenters = speakerIds.map(id => { const r = furniture.find(f => f.id === id).rect; return [r.x + r.w / 2, r.y + r.d / 2]; });
const span = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sideDistances = { left: span(seatPosition, speakerCenters[0]), right: span(seatPosition, speakerCenters[1]), between: span(...speakerCenters) };
const angleDegrees = Math.acos((sideDistances.left ** 2 + sideDistances.right ** 2 - sideDistances.between ** 2) / (2 * sideDistances.left * sideDistances.right)) * 180 / Math.PI;

const tea = {
  id: 'tea-study', roomId: 'living', cameraId: 'C-tea', counterId: 'F-L10', tableId: 'F-L04',
  label: label('茶与听音 · 日常深化', 'Tea and listening · daily-life study'),
  description: label('柜上烧水、坐下冲泡、收杯、清洗和归柜在同一茶湾内闭环。主通行改经回廊；热电壶留在柜上，小保温壶送到茶桌，坐姿干泡不横越归家或夜间路线。', 'Heat water at the counter, brew while seated, then wash and store within one tea bay. Main circulation uses the gallery; the electric kettle stays put while a small insulated server supplies the seated ritual.'),
  stations: [
    station('TS01', '洗涤与弃水', 'Wash and empty', '独立茶洗槽接收茶水与杯具；洗笔另在画室，不借用食品或茶水槽。', 'A dedicated tea sink handles cups and tea waste. Brush washing has its own studio basin.', 'F-L15', 'wash'),
    station('TS02', '沥水与擦干', 'Drain and dry', '洗后在水槽旁沥干，再擦干归柜；不把湿杯直接放入干茶抽屉。', 'Drain next to the sink, dry, then store. Keep wet cups out of the dry-tea drawers.', 'F-L16', 'dry'),
    station('TS03', '定点烧水', 'Stationary water heating', '电壶固定在耐热柜面，不端着通电或沸腾的电壶跨主路；具体温度按所泡茶类决定。', 'Keep the electric kettle on its heat-resistant counter, away from main circulation. Select water temperature for the tea.', 'F-L17', 'heat'),
    station('TS04', '洁净续水与托盘', 'Clean refill and tray', '柜上烧水后装入小保温壶，加盖托盘送至茶桌；0.55m只是人员局部服务站位间隔，不是器具全程。', 'Fill a small insulated server at the counter and carry it covered on the tray. The 0.55 m measure describes local standing positions, not the complete vessel journey.', 'F-L18', 'serve'),
    station('TS05', '坐姿干泡茶席', 'Seated tea ritual', '直径1.2m、桌高0.68m三人茶席，配茶盘、壶承/公道杯位置、小保温壶和废水盂；坐下冲泡与品饮，茶水柜负责烧水和洗涤。', 'A 1.2 m-diameter, 0.68 m-high table for three, with a tray, brewing / serving space, insulated server and waste bowl. Brew and drink seated; heat and wash at the counter.', 'F-L04', 'table')
  ],
  points: [
    point('TL01', '茶席吊灯', 'Tea-table pendant', '灯位对准茶桌，不作为穿行区低垂障碍。', 'The pendant sits above the table, outside walking routes.', 'lighting', [8.4, 8.1, 1.85], '暖色可调光；下沿研究高度1.70m，显色、眩光与实物样板待核。', 'Warm dimmable light; concept lower edge 1.70 m. Verify rendering, glare and a physical sample.', ['tea', 'solitude'], { fixture: { shape: 'pendant', diameter: .42, height: .3 } }),
    point('TL02', '茶柜工作灯', 'Tea-counter task light', '连续照亮水槽、沥水、烧水和托盘区。', 'Light the sink, drying, heating and clean-tray zones together.', 'lighting', [8.425, 5.76, 2.3], '2.30m线性工作灯；清洗场景优先操作照度，回路与灯型未定。', '2.30 m linear task light; prioritize useful light for cleaning. Circuit and product remain open.', ['tea', 'clean'], { fixture: { shape: 'linear', length: 2.3, depth: .035, height: .035 } }),
    point('TL03', '阅读落地灯', 'Reading floor lamp', '灯光停留在读书椅与唱片柜附近，不照向显示器或卧室。', 'Keep reading light by the chair and audio cabinet.', 'lighting', [4.66, 6.24, 1.5], '独立开关、局部照明；底座F-L19。', 'Independent local light; base footprint F-L19.', ['music', 'solitude'], { furnitureId: 'F-L19' }),
    point('TC01', '入口场景控制', 'Entry scene control', '从回廊入起居时可切换茶、听音、清洗和独处。', 'Choose tea, music, cleaning or solitude on entering from the gallery.', 'switch', [7.05, 5.61, 1.1], '靠P01东门垛；可用物理按键，不依赖手机。', 'Beside the east jamb of P01; physical controls remain usable without a phone.', ['tea', 'music', 'clean', 'solitude'], { wallId: 'W11' }),
    point('TP01', '烧水专用插座位', 'Kettle outlet position', '插座在烧水区后方，与西侧茶洗槽分开。', 'An outlet behind the heating zone, separated from the western sink.', 'power', [8.78, 5.61, 1.15], '独立可断电；负荷、保护与防溅规格由电气专业核定。', 'Individually switchable; an electrician must determine load, protection and splash requirements.', ['tea', 'clean'], { wallId: 'W11', furnitureId: 'F-L17' }),
    point('TP02', '音响低位电源', 'Low audio power', '电源与信号在唱片柜后检修；不沿D09门槛铺活动线。', 'Service power behind the record cabinet; no loose cable crosses D09.', 'power', [5, 5.61, .3], '柜后可检修；扬声器线沿北侧与西侧柜边暗藏，实际走线待声学/电气协调。', 'Keep service access. Conceal speaker runs along cabinetry and the west edge after acoustic/electrical coordination.', ['music', 'solitude'], { wallId: 'W11' }),
    point('TP03', '茶柜备用电源', 'Spare tea-counter power', '在洁净托盘一端预留，不放在水槽正上方。', 'Reserve power at the clean-tray end, away from directly above the sink.', 'power', [9.45, 5.61, 1.15], '用途与数量待设备清单确定；不用插线板堆叠。', 'Finalize use and count from the equipment inventory; avoid piled extension strips.', ['tea', 'clean'], { wallId: 'W11' }),
    point('TN01', '有线音频与网络', 'Wired audio / network', '唱片、流媒体和未来设备可共用可检修信号位。', 'Provide serviceable connections for records, streaming and future equipment.', 'data', [5.12, 5.61, .3], '强弱电分路策略待专业深化，不把线缆跨通道外露。', 'Coordinate signal/power separation professionally; keep cables off walking routes.', ['music'], { wallId: 'W11' }),
    point('TW01', '茶洗给水位', 'Tea-sink water supply', '给水在水槽柜内可检修。', 'Keep the supply accessible inside the sink cabinet.', 'supply', [7.51, 5.82, .55], '过滤、检修阀与防漏措施待设备选择。', 'Specify filtration, isolation and leak measures after equipment selection.', ['tea', 'clean'], { furnitureId: 'F-L15' }),
    point('TW02', '茶洗排水位', 'Tea-sink drainage', '湿区沿北服务带向餐厨协调，不以图中折线代替真实排水坡度。', 'Coordinate drainage along the northern service strip toward the kitchen; a diagram is not a drainage-gradient design.', 'drain', [7.51, 5.82, .35], '先弃茶渣后冲洗；存水弯、坡度、穿梁和清扫口由机电核验。', 'Remove leaves before rinsing. Verify traps, falls, structure crossings and cleaning access professionally.', ['clean'], { furnitureId: 'F-L15' }),
    point('TA01', '独处香气位', 'Optional solitude scent', '西端独立香品格与可取出无明火扩香盘，远离干茶、烧水和音响；泡茶时关闭并收起。', 'A closed western scent drawer and removable flame-free tray, away from tea, heating and audio. Close and put away for tea.', 'scent', [.49, 5.88, .875], '不用明火、雾化水汽或常开扩香；气味不代替通风，可完全撤掉。', 'No flame, mist or continuous diffusion. Scent does not replace ventilation and can be removed entirely.', ['solitude'], { furnitureId: 'F-L20' })
  ],
  storage: [
    record('ST01', '水槽与检修', 'Sink / service bay', '留给存水弯、阀门与可取出的废水/茶渣处理，不装干茶。', 'Reserve room for trap, valves and removable tea-waste handling; no dry tea here.', { rect: box(7.15, 5.7, .6, .6), baseHeight: .08, height: .78, opening: 'service-door' }),
    record('ST02', '杯具抽屉', 'Cup drawers', '常用杯在上、备用杯在下；洗后擦干再归位。', 'Daily cups above, spares below; dry them before storing.', { rect: box(7.75, 5.7, .6, .6), baseHeight: .08, height: .78, opening: 'drawer', drawerHeights: [.18, .24, .36] }),
    record('ST03', '托盘与耐热耗材', 'Trays / heat-zone supplies', '烧水壶下不放干茶，保留耐热耗材、托盘与检修；茶布分干湿归位。', 'No dry tea beneath the kettle; keep heat-tolerant supplies, trays and access here.', { rect: box(8.35, 5.7, .65, .6), baseHeight: .08, height: .78, opening: 'drawer', drawerHeights: [.18, .24, .36] }),
    record('ST04', '洁净端干茶内盒', 'Dry-tea tins at the clean end', '干茶在最东洁净端密封内盒，与烧水格设隔热分隔；温湿度和存量仍需试用核验。', 'Store sealed dry tea at the eastern clean end, thermally separated from the heating module. Check temperature, humidity and real inventory.', { rect: box(9, 5.7, .7, .6), baseHeight: .08, height: .78, opening: 'door', shelves: [.4], thermalBreak: true })
  ],
  routes: [
    record('TR01', '局部续水', 'Local refill', '热电壶留柜上，小保温壶加盖置托盘送茶席；图示0.55m是东北侧人员局部站位间隔，不是器具全程；不跨主路。', 'Keep the electric kettle on the counter and carry a covered insulated server on the tray. The 0.55 m line is a local standing interval, not the complete vessel journey; main routes stay separate.', { kind: 'hot-service', width: .5, points: [[9.1, 6.65], [9.1, 7.2]] }),
    record('TR02', '收杯 · 清洗 · 归柜', 'Collect · wash · store', '从东北服务位收杯，沿茶柜前回到西侧洗槽，再沥干归柜；干湿操作分端。', 'Collect at the northeast service point, return along the counter to the west sink, then dry and store.', { kind: 'cleanup', width: .5, points: [[9.1, 7.2], [9.1, 6.65], [7.5, 6.65]] })
  ],
  steps: [
    record('T01', '取器与布席', 'Set the tray', '从ST02取干杯、ST03取茶布托盘、ST04取密封干茶，先在柜上布置；主路保持畅通。', 'Take cups from ST02, cloth / trays from ST03 and sealed dry tea from ST04; prepare on the counter and keep circulation clear.'),
    record('T02', '柜上烧水', 'Heat at the counter', '在TS03烧水，装入小保温壶后加盖、置洁净托盘送茶席；电水壶保持原位，温度按茶类决定。', 'Heat at TS03, then cover the small insulated server and carry it on the clean tray. Keep the electric kettle in place; select temperature for the tea.'),
    record('T03', '坐下冲泡与慢饮', 'Brew seated / drink slowly', '在TS05茶盘上坐姿干泡，用壶承、公道杯和小废水盂完成仪式；TR01标局部服务站位，不把沸壶穿过归家路径。', 'Brew seated at the TS05 tray with brewing / serving space and a small waste bowl. TR01 marks local service positions rather than carrying a boiling kettle through arrival routes.'),
    record('T04', '弃渣与清洗', 'Empty / wash', '茶渣先入可取出的容器，杯具到TS01；不用茶水槽处理画材。', 'Collect leaves before washing cups at TS01; keep art materials out of this sink.'),
    record('T05', '沥干与归位', 'Dry / reset', 'TS02沥干、擦干、回到对应柜格；夜间只留局部灯光。', 'Drain at TS02, dry, return to the correct module and leave only local evening light.')
  ],
  scenes: [
    record('tea', '泡茶', 'Tea', '柜上烧水、坐下干泡，茶柜工作灯与茶席灯分层开启；主路绕过操作区，香品关闭收起。', 'Heat at the counter and brew seated under layered light; keep main routes clear and put scent products away.', { layer: 'ritual', pointIds: ['TL01', 'TL02', 'TC01', 'TP01'], stationIds: ['TS01', 'TS02', 'TS03', 'TS04', 'TS05'] }),
    record('music', '听音', 'Music', '茶柜灯关闭或调暗，听位回到沙发中央；三角形只是约60°试摆起点。', 'Dim the counter, sit at the sofa centre and treat the approximately 60° triangle as a listening trial.', { layer: 'audio', pointIds: ['TL03', 'TP02', 'TN01'] }),
    record('clean', '清洗', 'Clean', '提高柜面工作照明，先弃渣再洗杯，沥干归柜后结束。', 'Use task light; remove leaves, wash, dry and reset.', { layer: 'services', pointIds: ['TL02', 'TP01', 'TP03', 'TW01', 'TW02'] }),
    record('solitude', '独处', 'Solitude', '只留阅读灯或低亮茶灯；香气可选、可撤，机器与工作仍在可关门的书房。', 'Keep local light and optional removable scent while work and machines remain behind the study door.', { layer: 'audio', pointIds: ['TL01', 'TL03', 'TP02', 'TA01'] })
  ],
  listening: { seatPosition, speakerIds, speakerCenters, sideDistances, angleDegrees, triangle: [speakerCenters[0], seatPosition, speakerCenters[1]], description: label(`主听位(2.80,6.80)，两箱中心距${sideDistances.between.toFixed(2)}m、左右听距约${sideDistances.left.toFixed(2)}m，夹角约${angleDegrees.toFixed(1)}°。这是一组可试听的约60°试摆；窗面反射、帘布、音量和0–20°内倾仍需现场调，不承诺茶席每个座位都是主听位。`, `The main seat (2.80, 6.80) has a ${sideDistances.between.toFixed(2)} m speaker span, approximately ${sideDistances.left.toFixed(2)} m listening distances and a ${angleDegrees.toFixed(1)}° angle. This is an adjustable approximately 60° trial. Tune glass reflections, curtains, level and 0–20° toe-in on site; tea seats are not all sweet spots.`) },
  scent: record('SC01', '香气可选，也可以没有', 'Optional scent, including none', '西段F-L08独立闭合香品格与F-L20可取出扩香盘；与干茶和音响分开。只在独处场景按需短时使用，泡茶时关闭收起，不设置明火和雾化水汽。', 'A closed scent compartment in F-L08 and removable F-L20 tray stay separate from tea and audio. Optional short use during solitude; close and put away for tea. No flame or mist.', { furnitureId: 'F-L20', storageParentId: 'F-L08', storageRect: box(.12, 5.7, .65, .36), enabledSceneIds: ['solitude'], disabledSceneIds: ['tea', 'clean'], flameFree: true, removable: true })
};

const estate = {
  id: 'estate-study', label: label('园居 · 分期远景', 'Garden home · phased horizon'),
  description: label('1190㎡假想地块，用于园居关系研究，不是真实土地、测绘或可获批的用地结论。主宅200㎡保持独立核算，新增翼房与泳池按分期另列。', 'A hypothetical 1,190 m² parcel for spatial study, not actual land, a survey or an approval. The 200 m² core remains separate from a phased wing and outdoor pool.'),
  bounds: { ...box(-5, -5, 34, 35), area: 1190 },
  phases: [
    record('phase-1', '一期 · 主宅与内庭', 'Phase 1 · core and courtyard', '200㎡概念建面含166㎡净功能；原15.54㎡预留室成为可逆画室，30㎡内庭另列。', '200 m² gross concept includes 166 m² net; the existing 15.54 m² room becomes a reversible art studio. The 30 m² court is separate.', { order: 1 }),
    record('phase-2', '二期 · 影音与健身翼', 'Phase 2 · media / fitness wing', '独立东南翼60㎡净功能，加12㎡构造设备预留，合72㎡新增概念建面。', 'A detached southeast wing adds 60 m² net plus 12 m² allowance, or 72 m² additional gross concept.', { order: 2 }),
    record('phase-3', '三期 · 泳池与池畔', 'Phase 3 · pool / deck', '36㎡水面与54㎡池畔为室外面积；先确认维护、用水、机房和四边安全围界。', '36 m² water and 54 m² deck are outdoors. Resolve maintenance, water, plant and a four-sided safety enclosure first.', { order: 3 })
  ],
  program: [
    record('core', '主宅', 'Core house', '图示沿用166㎡净功能控制线；200㎡概念建面含34㎡构造设备预留，不能把14×14包围盒当实测外廓。', 'The drawing retains the 166 m² net control geometry. The 200 m² gross concept includes a 34 m² allowance; its 14 × 14 bounding box is not a surveyed envelope.', { phase: 'phase-1', rect: box(0, 0, 14, 14), polygons: zones.filter(z => !z.outdoor).flatMap(z => z.polygons), area: 200, netArea: 166, grossArea: 200, areaBasis: 'gross' }),
    record('studio', '主宅内画室', 'Art studio in the core', '15.54㎡已在主宅166㎡净功能内；不再重复增加建筑面积。', '15.54 m² is already inside the core net area; it is not additional floor area.', { phase: 'phase-1', roomId: 'reserve', rect: box(10.3, 0, 3.7, 4.2), area: 15.54, netArea: 15.54, grossArea: 0, includedInCore: true, areaBasis: 'core-net' }),
    record('arrival', '露天停车与抵达', 'Open parking / arrival', '3×6m露天停车位与邻近单车/快递格属于室外预留，不默认为车库建筑面积。', 'A 3 × 6 m open parking bay with nearby cycle / parcel storage is an outdoor reservation, not assumed garage floor area.', { phase: 'phase-1', rect: box(21, -1, 3, 6), area: 18, netArea: 0, grossArea: 0, areaBasis: 'outdoor-arrival' }),
    record('gym', '庭园健身房', 'Garden gym', '6×4m净空间，留可移动器材与伸展；荷载、振动和通风待设备清单核验。', 'A 6 × 4 m net room for movable equipment and stretching; verify load, vibration and ventilation from the equipment list.', { phase: 'phase-2', rect: box(18, 14, 6, 4), area: 24, netArea: 24, grossArea: 28.8, areaBasis: 'net' }),
    record('wing-service', '淋浴 · 更衣 · 设备', 'Shower / change / plant', '与健身、影音分隔，服务泳池与翼房；湿区和设备房仍需专业划分。', 'Separate support for the pool and wing; professionally divide wet services and plant space.', { phase: 'phase-2', rect: box(18, 18, 6, 2), area: 12, netArea: 12, grossArea: 14.4, areaBasis: 'net' }),
    record('media', '独立影音室', 'Detached media room', '6×4m净空间，避开卧室共墙；隔声、低频与静音通风优先，不把软包当隔音。', 'A 6 × 4 m net room without a shared bedroom wall. Prioritize isolation, bass control and quiet ventilation.', { phase: 'phase-2', rect: box(18, 20, 6, 4), area: 24, netArea: 24, grossArea: 28.8, areaBasis: 'net' }),
    record('pool', '泳池水面', 'Pool water', '12×3m的36㎡水面属于后期室外愿景；水深、结构、处理系统和审批未定。', 'A 12 × 3 m, 36 m² water area is a later outdoor study; depth, structure, treatment and approvals remain open.', { phase: 'phase-3', rect: box(2, 20, 12, 3), area: 36, netArea: 0, grossArea: 0, areaBasis: 'outdoor-water' }),
    record('pool-deck', '池畔活动面', 'Pool deck', '15×6m围合范围扣除36㎡水面，池畔净54㎡；不计室内建面。', 'A 15 × 6 m enclosure minus 36 m² water leaves 54 m² deck, separate from indoor floor area.', { phase: 'phase-3', rect: box(.5, 18.5, 15, 6), voidRect: box(2, 20, 12, 3), area: 54, netArea: 0, grossArea: 0, areaBasis: 'outdoor-deck' })
  ],
  paths: [
    record('EP01', '主宅至生活翼', 'Core to garden wing', '1.2m研究步道连接归家入口和独立翼，不要求穿过泳池围界。', 'A 1.2 m study path links the entrance and detached wing without entering the pool enclosure.', { phase: 'phase-2', width: 1.2, points: [[12.7, 14.8], [12.7, 16], [16.5, 16], [18, 16]] }),
    record('EP02', '翼房服务步道', 'Wing service path', '健身、设备和影音各从西侧步道到达，夜间噪声与湿脚不穿卧室。', 'A west-side path serves the gym, services and media room without crossing bedrooms.', { phase: 'phase-2', width: 1.2, points: [[16.5, 16], [16.5, 22], [18, 22]] }),
    record('EP03', '内庭至外园', 'Inner court to outer garden', '从EG01南侧门到外园，再经独立泳池安全门PG01入池畔；入口不借主宅门替代。', 'Leave through EG01, then enter the pool deck through its own PG01 safety gate.', { phase: 'phase-3', width: 1.2, gateIds: ['EG01', 'PG01'], points: [[4.8, 13.1], [4.8, 16.5], [8, 16.5], [8, 19.2]] }),
    record('EP04', '健身后更衣', 'Gym to changing', '通过翼内门ED04到更衣淋浴，不穿影音室。', 'Use internal ED04 for changing / showering, without crossing the media room.', { phase: 'phase-2', width: .8, gateIds: ['ED04'], points: [[19, 17], [19, 19]] }),
    record('EP05', '更衣至池门', 'Changing to pool gate', '经ED02回外部步道，再从PG01入池畔，干湿路径不借影音座位穿行。', 'Leave through ED02, follow the external path and enter PG01; wet traffic never crosses media seating.', { phase: 'phase-3', width: .8, gateIds: ['ED02', 'PG01'], points: [[19, 19], [16.5, 19], [16.5, 17], [8, 17], [8, 19.2]] }),
    record('EP06', '步行门至归家', 'Pedestrian gate to home', '从假想东侧接路面经EG02步行门，绕翼房北侧到D01；不穿健身房。', 'Walk through EG02 and around the north of the wing to D01, without crossing the gym.', { phase: 'phase-1', width: 1.2, gateIds: ['EG02', 'D01'], points: [[29.5, 9.8], [26, 9.8], [26, 12], [16.5, 12], [16.5, 16], [12.7, 16], [12.7, 14.8]] }),
    record('EP07', '露天停车进场', 'Open-parking arrival', '东侧EG03车行口通露天车位；与步行门分开，实际转弯与接路待基地测绘。', 'EG03 serves open parking separately from the pedestrian gate; turning and actual road access await a real survey.', { phase: 'phase-1', width: 3, kind: 'vehicle', gateIds: ['EG03'], points: [[29.5, 2.75], [24, 2.75]] }),
    record('EP08', '东侧设备检修', 'Eastern plant access', '设备维护从东侧外部通路到ED05，不穿卧室、茶室或泳池围界。', 'Reach ED05 from the eastern service path without crossing bedrooms, tea or the pool enclosure.', { phase: 'phase-2', width: 1.2, gateIds: ['ED05'], points: [[26, 12], [26, 19], [24, 19]] })
  ],
  boundaries: [
    record('EB01', '西侧隐私界', 'West privacy edge', '以实体围墙和内侧种植形成背景，不假定场地外有远山。', 'A wall and planting form the backdrop; no unselected mountain view is assumed.', { a: [-5, -5], b: [-5, 30], height: 1.8, kind: 'privacy-wall', phase: 'phase-1' }),
    record('EB02', '南侧隐私界', 'South privacy edge', '南侧同样以墙和种植收边，具体材料和基地退界待定。', 'A southern wall and planting close the view; materials and real setbacks remain open.', { a: [-5, 30], b: [29, 30], height: 1.8, kind: 'privacy-wall', phase: 'phase-1' }),
    record('EB03', '内庭西侧绿屏', 'Inner-court west screen', '1.5m通透种植屏界；不把茶窗外临时补成封死的高墙。', 'A 1.5 m planted screen, rather than an invented high wall immediately outside the tea window.', { a: [0, 9], b: [0, 14], height: 1.5, kind: 'planted-screen', phase: 'phase-1' }),
    record('EB04', '内庭南侧绿屏', 'Inner-court south screen', '同高绿屏留一处1.2m步行门，内外庭院可以真正相通。', 'The screen includes a 1.2 m walking gate linking inner and outer gardens.', { a: [0, 14], b: [6, 14], height: 1.5, kind: 'planted-screen', phase: 'phase-1', opening: { id: 'EG01', a: [4.2, 14], b: [5.4, 14], operation: 'gate' } }),
    record('EB05', '东侧抵达界', 'East arrival edge', '低绿篱标边，EG02步行门与EG03车行口分别接假想道路；不是实有道路或获批开口。', 'A low hedge with separate EG02 pedestrian and EG03 vehicle openings meets a hypothetical road, not a verified access approval.', { a: [29, -5], b: [29, 30], height: 1.2, kind: 'hedge', phase: 'phase-1', openings: [{ id: 'EG02', a: [29, 9.2], b: [29, 10.4], kind: 'pedestrian' }, { id: 'EG03', a: [29, 1], b: [29, 4.5], kind: 'vehicle' }] }),
    record('EB06', '北侧前园界', 'North foregarden edge', '以1.2m低绿篱收边，边界外不预设风景或可使用土地。', 'A 1.2 m hedge defines the foregarden; land and views beyond are not assumed.', { a: [-5, -5], b: [29, -5], height: 1.2, kind: 'hedge', phase: 'phase-1' })
  ],
  planting: [
    record('PL01', '内庭通透小乔木', 'Light-canopied inner-court tree', '保留原树位(3,11.5)与通透冠层；树种随城市气候、根域、落叶和维护确定，不将它冒认为已定桂树。', 'Retain the existing tree position and open crown. Select species for climate, roots and maintenance rather than silently calling it osmanthus.', { position: [3, 11.5], species: label('树种待气候确认', 'Species pending climate'), canopyRadius: 1.4, rootZoneRadius: 1.5, phase: 'phase-1', spec: label('模型树高4m仅空间占位。', 'The modelled 4 m height is only a spatial placeholder.') }),
    record('PL02', '外园桂树候选', 'Outer-garden osmanthus candidate', '放在外园而非挤进内庭；留冠幅、根域与落花维护空间，是否适种待城市和气候确认。', 'Place the candidate in the outer garden with crown, roots and flower cleanup space. Suitability awaits a real climate.', { position: [-2, 18], species: label('桂花 Osmanthus fragrans · 条件候选', 'Osmanthus fragrans · conditional candidate'), canopyRadius: 2.15, rootZoneRadius: 2.3, phase: 'phase-2', spec: label('研究冠幅3–4.3m、高3–6m；并非定苗或栽植许可。', 'Research range: crown 3–4.3 m, height 3–6 m; not a selected specimen or planting approval.') }),
    record('PL03', '西侧复层种植', 'Layered western planting', '在外墙与内庭之间形成可维护的林下层次；不遮蔽门窗、步道和检修。', 'Layer maintainable planting between the outer wall and court without blocking windows, paths or service access.', { position: [-2, 8], species: label('气候适配灌木与地被', 'Climate-suitable shrubs / ground cover'), canopyRadius: 1.2, rootZoneRadius: 1.2, phase: 'phase-1', spec: label('详细品种、密度、土壤与灌溉待现场。', 'Species, density, soil and irrigation await the site.') })
  ],
  poolSafety: { id: 'PS01', label: label('泳池独立安全围界', 'Independent pool safety enclosure'), description: label('泳池以自身四边围界隔离，不能借地界墙或主宅门替代；示意1.5m高围界、自闭自锁门、非攀爬构造、防滑与可视监督，实际高度、间隙、锁位和报警依当地要求专业核验。本图不宣称安全认证。', 'Use a separate four-sided enclosure, not a boundary wall or house door. The 1.5 m study includes a self-closing/latching gate, non-climbable detailing, slip resistance and supervision sight lines. Verify actual height, gaps, latch and alarms locally; this is not a safety certification.'), rect: box(.5, 18.5, 15, 6), height: 1.5, gate: { id: 'PG01', a: [7.4, 18.5], b: [8.6, 18.5], selfClosing: true, selfLatching: true } },
  areaSummary: { parcelArea: 1190, coreGrossArea: 200, coreNetArea: 166, additionalGrossArea: 72, additionalNetArea: 60, totalGrossArea: 272, totalNetArea: 226, courtyardArea: 30, poolWaterArea: 36, poolDeckArea: 54, description: label('1190㎡是假想用地。主宅200㎡建面/166㎡净功能；后期翼房另增72㎡建面/60㎡净功能，全部远景合272㎡建面/226㎡净功能。30㎡内庭、36㎡池水、54㎡池畔均为室外单列，不相加成室内面积。', 'The hypothetical parcel is 1,190 m². Core: 200 m² gross / 166 m² net. Later wing: 72 m² gross / 60 m² net. Full horizon: 272 m² gross / 226 m² net. The 30 m² court, 36 m² water and 54 m² deck remain separate outdoor areas.') }
};

estate.wing = {
  id: 'garden-wing', netArea: 60, grossArea: 72, height: 2.9,
  walls: [
    { id: 'EW01', a: [18, 14], b: [18, 24] }, { id: 'EW02', a: [24, 14], b: [24, 24] },
    { id: 'EW03', a: [18, 14], b: [24, 14] }, { id: 'EW04', a: [18, 24], b: [24, 24] },
    { id: 'EW05', a: [18, 18], b: [24, 18] }, { id: 'EW06', a: [18, 20], b: [24, 20] },
    { id: 'EW07', a: [21, 18], b: [21, 20] }
  ],
  openings: [
    { id: 'ED01', wallId: 'EW01', a: [18, 15.35], b: [18, 16.65], connects: ['outside', 'gym'], type: 'door' },
    { id: 'ED02', wallId: 'EW01', a: [18, 18.5], b: [18, 19.5], connects: ['outside', 'changing'], type: 'door' },
    { id: 'ED03', wallId: 'EW01', a: [18, 21.4], b: [18, 22.6], connects: ['outside', 'media'], type: 'door' },
    { id: 'ED04', wallId: 'EW05', a: [18.5, 18], b: [19.5, 18], connects: ['gym', 'changing'], type: 'door' },
    { id: 'ED05', wallId: 'EW02', a: [24, 18.35], b: [24, 19.65], connects: ['outside', 'plant'], type: 'door' },
    { id: 'EV01', wallId: 'EW02', a: [24, 14.8], b: [24, 17.2], connects: ['outside', 'gym'], type: 'window' },
    { id: 'EV02', wallId: 'EW04', a: [20.5, 24], b: [22.5, 24], connects: ['outside', 'media'], type: 'blackout-window' }
  ],
  furniture: [
    { id: 'EF01', roomId: 'gym', label: label('力量器材预留', 'Strength equipment'), rect: box(19, 14.4, 1.6, 1.2), height: 2.2 },
    { id: 'EF02', roomId: 'gym', label: label('跑步机预留', 'Treadmill'), rect: box(22.2, 14.8, 1, 2), height: 1.5 },
    { id: 'EF03', roomId: 'gym', label: label('伸展垫', 'Stretching mat'), rect: box(20.6, 16.6, 2, 1), height: .02, blocking: false },
    { id: 'EF04', roomId: 'changing', label: label('更衣凳', 'Changing bench'), rect: box(18.15, 19.55, 1.2, .3), height: .45 },
    { id: 'EF05', roomId: 'changing', label: label('淋浴预留', 'Shower reservation'), rect: box(19.7, 18.1, 1.2, 1.2), height: 2.2, blocking: false },
    { id: 'EF06', roomId: 'plant', label: label('独立设备检修区', 'Independent plant bay'), rect: box(21.2, 18.15, 2.2, .6), height: 1.8 },
    { id: 'EF07', roomId: 'media', label: label('投影幕', 'Projection screen'), rect: box(19, 20.1, 4, .12), height: 1.8 },
    { id: 'EF08', roomId: 'media', label: label('三人观影位', 'Three-person media seat'), rect: box(19.1, 22.1, 3.1, .9), height: .9 }
  ],
  mediaAccess: { width: .8, points: [[18, 22], [18.5, 22], [18.5, 23.5], [20.5, 23.5]] }
};
estate.arrivalStorage = record('EA01', '单车与快递格', 'Cycle / parcel storage', '露天停车旁的轻量收纳，不增加封闭车库。', 'Light storage next to open parking, without adding an enclosed garage.', { rect: box(24.2, 1, 1.2, .6), height: 1.2 });

const courtyardBoundary = {
  id: 'B-W03', wallId: 'W03', openingIds: ['V06', 'D09'], insideCameraId: 'C-living', outsideCameraId: 'C-garden',
  label: label('同一面墙 · 从室内与庭院看', 'One wall · inside and outside'),
  description: label('W03全长6m、墙厚0.24m、墙顶2.70m；V06窗台0.15m、窗顶2.50m，D09门槛0/门顶2.50m。窗门间0.15m实垛不随影像改动；两面图为同一组尺寸，外观左到右与室内向南看镜像。', 'W03 is 6 m long, 0.24 m thick and 2.70 m high. V06 sill/head: 0.15/2.50 m; D09 threshold/head: 0/2.50 m. The 0.15 m pier is fixed. Both elevations use one dimension set and reverse for the south-looking interior view.'),
  roofEdge: { soffit: 2.7, top: 2.9, projection: .45, normal: [0, 1], description: label('统一研究平屋面边缘：底2.70m、顶2.90m，向庭院挑0.45m；构造、防水、排水与受力尚待专业深化。', 'A shared flat-roof edge: soffit 2.70 m, top 2.90 m, 0.45 m projection into the court. Structure, waterproofing and drainage remain to be developed.') }
};

export const SPATIAL_MODEL = {
  version: 3,
  units: 'm',
  coordinateSystem: { origin: 'north-west control-line corner', x: 'east', y: 'south', z: 'up', north: [0, -1] },
  ceilingHeight: 2.7,
  envelope: { width: 14, depth: 14, netArea: 166, grossAllowance: 34, grossArea: 200, courtyardArea: 30 },
  zones, spaces, walls, openings, furniture, routes, cameras, tea, estate, courtyardBoundary,
  note: label('同一模型约束门窗、家具、动线、立面与几何视图；影像仍是材质氛围研究。0.75–0.9m 路线为当前概念净通行带，非无障碍或施工验收结论。', 'One model governs openings, furniture, routes, elevations and geometric views. Atmospheric images remain material studies. The 0.75–0.9 m paths are concept clearances, not accessibility or construction certification.')
};

export const roomById = id => zones.find(room => room.id === id);
export const wallById = id => walls.find(item => item.id === id);
export const cameraByRoomId = id => cameras.find(item => item.roomId === id);
export const cameraById = id => cameras.find(item => item.id === id);
