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
  zone('reserve', '未来预留室', 'A room for later', 15.54, [[10.3, 0, 3.7, 4.2]], [12.15, 3.35]),
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
  opening('D06', '预留室门', 'Reserve-room door', 'W10', 'door', [12.7, 4.2], [13.6, 4.2], ['gallery', 'reserve'], { hinge: 'b', swing: 'north' }),
  opening('D07', '完整浴室门', 'Full-bathroom door', 'W12', 'door', [5.95, 2.5], [6.85, 2.5], ['bath-lobby', 'bath-main'], { hinge: 'b', swing: 'north' }),
  opening('D08', '客用洗手间移门', 'Guest WC pocket door', 'W13', 'door', [5.8, 3.0], [5.8, 3.8], ['bath-lobby', 'bath-wc'], { operation: 'pocket', slideTo: 'north' }),
  opening('D09', '庭院推拉门', 'Courtyard sliding door', 'W03', 'door', [4.2, 9], [5.4, 9], ['living', 'garden'], { operation: 'sliding', head: 2.5, slideTo: 'west' }),
  opening('P01', '回廊至起居', 'Gallery to living', 'W11', 'passage', [5.8, 5.6], [7, 5.6], ['gallery', 'living']),
  opening('P02', '回廊至餐厨', 'Gallery to kitchen', 'W11', 'passage', [10.1, 5.6], [11.3, 5.6], ['gallery', 'kitchen']),
  opening('P03', '餐厨至起居', 'Kitchen to living', 'W15', 'passage', [10, 6.1], [10, 7.6], ['kitchen', 'living']),
  opening('P04', '玄关至餐厨', 'Vestibule to kitchen', 'W17', 'passage', [10.1, 11], [11.3, 11], ['vestibule', 'kitchen']),
  opening('V01', '主卧北窗', 'Bedroom north window', 'W01', 'window', [.75, 0], [3.45, 0], ['bedroom', 'outside'], { sill: 1.05, head: 2.5, operation: 'operable' }),
  opening('V02', '浴室高窗', 'Bathroom high window', 'W01', 'window', [4.65, 0], [6.55, 0], ['bath-main', 'outside'], { sill: 1.6, head: 2.5, operation: 'operable-obscure' }),
  opening('V03', '客房北窗', 'Guest north window', 'W01', 'window', [7.5, 0], [9.8, 0], ['flex', 'outside'], { sill: 1.05, head: 2.5, operation: 'operable' }),
  opening('V04', '预留室北窗', 'Reserve north window', 'W01', 'window', [10.85, 0], [13.55, 0], ['reserve', 'outside'], { sill: .95, head: 2.5, operation: 'operable' }),
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
  item('F-L04', 'living', '茶桌', 'Tea table', 'tea-table', [7.8, 7.7, 1.2, 1.2], .68, { shape: 'ellipse' }),
  item('F-L05', 'living', '茶椅一', 'Tea chair one', 'chair', [8.15, 7.11, .5, .48], .78),
  item('F-L06', 'living', '茶椅二', 'Tea chair two', 'chair', [7.15, 8.06, .5, .48], .78, { rotation: 270 }),
  item('F-L07', 'living', '茶椅三', 'Tea chair three', 'chair', [9.1, 8.06, .5, .48], .78, { rotation: 90 }),
  item('F-L08', 'living', '西段低书柜', 'West low bookcase', 'shelf', [.12, 5.7, 2.06, .36], .85),
  item('F-L09', 'living', '音响与唱片柜', 'Audio and record cabinet', 'shelf', [4.45, 5.7, 1.1, .36], .75),
  item('F-L10', 'living', '茶具与在读收纳', 'Tea ware and current-reading storage', 'shelf', [7.3, 5.7, 2.05, .36], .85),
  item('F-L11', 'living', '左落地音箱', 'Left floor speaker', 'speaker', [1.3, 8.4, .26, .3], .88, { rotation: 180, frontDirection: 'north' }),
  item('F-L12', 'living', '右落地音箱', 'Right floor speaker', 'speaker', [4.05, 8.4, .26, .3], .88, { rotation: 180, frontDirection: 'north' }),
  item('F-L13', 'living', '转角阅读长凳', 'Reading bench in the return', 'bench', [6.55, 9.55, 2.65, .44], .43),
  item('F-L14', 'living', '亚麻地毯', 'Linen rug', 'rug', [1.05, 6.3, 4.45, 2.15], .015, { blocking: false }),
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
  item('F-R01', 'reserve', '可移动桌', 'Movable table', 'desk', [11.1, 1.2, 1.8, .8], .74, { provisional: true }),
  item('F-R02', 'reserve', '可移动收纳', 'Movable storage', 'shelf', [10.5, .2, .56, 2.5], 1.1, { provisional: true }),
  item('F-R03', 'reserve', '活动椅', 'Loose chair', 'chair', [11.75, 2.11, .5, .48], .8, { rotation: 180, provisional: true }),
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
  { id: 'R02', label: label('洗手备茶 · 起居 · 入庭', 'Prepare tea · living · courtyard'), width: .9, rooms: ['entry', 'kitchen', 'living', 'garden'], points: [[12.7, 12.6], [10.65, 12.6], [10.65, 6.65], [6.4, 6.65], [6.4, 8.5], [4.8, 8.5], [4.8, 10.4]] },
  { id: 'R03', label: label('夜间 · 回廊 · 安睡', 'Evening · gallery · sleep'), width: .75, rooms: ['kitchen', 'living', 'entry', 'bedroom'], points: [[10.65, 10.6], [10.65, 6.65], [6.4, 6.65], [6.4, 4.9], [3.55, 4.9], [3.55, 3.35], [2.5, 3.35]] }
];

// Horizontal lenses are deliberate: geometric reference views stay undistorted.
const camera = (roomId, position, target, fov = 65) => ({ id: `C-${roomId}`, roomId, position, target, eyeHeight: 1.5, targetHeight: 1.5, fov });
const cameras = [
  camera('living', [9.4, 6.5], [3.2, 7.9], 70),
  camera('study', [9.1, 13.45], [7.4, 11.5]),
  camera('bedroom', [3.05, 3.8], [2.1, 1.5]),
  camera('kitchen', [10.55, 10.65], [12.6, 7.3], 70),
  camera('flex', [8.8, 3.8], [8.2, 1.2]),
  camera('reserve', [12.6, 3.75], [11.65, 1.6]),
  camera('bath', [6.45, 1.45], [4.85, .65], 75),
  camera('entry', [11.3, 12.9], [13.1, 11.65], 70),
  camera('garden', [5.3, 13.2], [2.3, 10.8], 75)
];

export const SPATIAL_MODEL = {
  version: 2,
  units: 'm',
  coordinateSystem: { origin: 'north-west control-line corner', x: 'east', y: 'south', z: 'up', north: [0, -1] },
  ceilingHeight: 2.7,
  envelope: { width: 14, depth: 14, netArea: 166, grossAllowance: 34, grossArea: 200, courtyardArea: 30 },
  zones, spaces, walls, openings, furniture, routes, cameras,
  note: label('同一模型约束门窗、家具、动线、立面与几何视图；影像仍是材质氛围研究。0.75–0.9m 路线为当前概念净通行带，非无障碍或施工验收结论。', 'One model governs openings, furniture, routes, elevations and geometric views. Atmospheric images remain material studies. The 0.75–0.9 m paths are concept clearances, not accessibility or construction certification.')
};

export const roomById = id => zones.find(room => room.id === id);
export const wallById = id => walls.find(item => item.id === id);
export const cameraByRoomId = id => cameras.find(item => item.roomId === id);
