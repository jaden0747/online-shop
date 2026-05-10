import fs from "fs";
import path from "path";
import { BASE_DATA_DIR, TESTING_FLAG, writeRows } from "./excel";
import type { Customer, CustomerAddress, Subscription, MenuItem } from "./types";
import { weekLabelForDate } from "../utils/week";

export function isTestingMode(): boolean {
  return fs.existsSync(TESTING_FLAG);
}

export function enableTestingMode(): void {
  const testDir = path.join(BASE_DATA_DIR, "test");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  // Copy static files before setting the flag so they're available
  copyStaticFiles();
  fs.writeFileSync(TESTING_FLAG, "1");
  seedDefaultScenario();
}

export function disableTestingMode(): void {
  if (fs.existsSync(TESTING_FLAG)) fs.unlinkSync(TESTING_FLAG);
}

export type ScenarioId = "default" | "empty" | "expiring-soon" | "all-active";

export function loadScenario(id: ScenarioId): void {
  seedScenario(id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  d.setHours(0, 0, 0, 0);
  // Shift weekends to the next Monday so dates are always on working days
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function copyStaticFiles() {
  const testDir = path.join(BASE_DATA_DIR, "test");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  // Only copy pricing — addresses are generated from the HCMC pool
  for (const file of ["pricing.xlsx"]) {
    const src = path.join(BASE_DATA_DIR, file);
    const dest = path.join(testDir, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  }
}

function clearTestSheets() {
  writeRows("selections.xlsx", "Selections", []);
  writeRows("notes.xlsx", "Notes", []);
  writeRows("menu.xlsx", "Menu", []);
  writeRows("addresses.xlsx", "Addresses", []);
}

// ---------------------------------------------------------------------------
// HCMC addresses (realistic districts, real lat/lng ±~200m jitter)
// ---------------------------------------------------------------------------

// Each entry: [label, address, district/zone, lat, lng]
const HCMC_ADDR_POOL: Array<[string, string, string, number, number]> = [
  ["Home", "12 Nguyễn Huệ, Bến Nghé, Quận 1", "Quận 1", 10.7737, 106.7033],
  ["Home", "56 Lê Lợi, Phường Bến Thành, Quận 1", "Quận 1", 10.7726, 106.6981],
  ["Home", "78 Đinh Tiên Hoàng, Phường Đa Kao, Quận 1", "Quận 1", 10.7869, 106.7009],
  ["Home", "34 Trần Hưng Đạo, Phường Nguyễn Cư Trinh, Quận 1", "Quận 1", 10.7660, 106.6961],
  ["Home", "101 Lý Tự Trọng, Phường Bến Nghé, Quận 1", "Quận 1", 10.7752, 106.7012],
  ["Home", "22 Võ Thị Sáu, Phường 7, Quận 3", "Quận 3", 10.7845, 106.6892],
  ["Home", "88 Nam Kỳ Khởi Nghĩa, Phường 8, Quận 3", "Quận 3", 10.7804, 106.6878],
  ["Home", "15 Nguyễn Đình Chiểu, Phường 1, Quận 3", "Quận 3", 10.7763, 106.6930],
  ["Home", "200 Lê Văn Sỹ, Phường 14, Quận 3", "Quận 3", 10.7939, 106.6844],
  ["Home", "67 Trần Quốc Thảo, Phường 7, Quận 3", "Quận 3", 10.7867, 106.6859],
  ["Home", "120 Nguyễn Thị Minh Khai, Phường 6, Quận 3", "Quận 3", 10.7792, 106.6905],
  ["Home", "45 Phan Xích Long, Phường 3, Phú Nhuận", "Phú Nhuận", 10.7980, 106.6840],
  ["Home", "9 Hoàng Văn Thụ, Phường 8, Phú Nhuận", "Phú Nhuận", 10.8009, 106.6803],
  ["Home", "33 Nguyễn Trọng Tuyển, Phường 10, Phú Nhuận", "Phú Nhuận", 10.7952, 106.6762],
  ["Home", "77 Võ Văn Tần, Phường 6, Quận 3", "Quận 3", 10.7738, 106.6920],
  ["Office", "250 Điện Biên Phủ, Phường 7, Quận 3", "Quận 3", 10.7893, 106.6931],
  ["Office", "18 Công Trường Mê Linh, Bến Nghé, Quận 1", "Quận 1", 10.7741, 106.7061],
];

function makeAddresses(customers: Customer[]): CustomerAddress[] {
  const now = new Date().toISOString();
  const addrs: CustomerAddress[] = [];
  // Assign addresses round-robin across the full pool so all distance bands are covered
  customers.forEach((cust, ci) => {
    const primary = ALL_ADDRS[ci % ALL_ADDRS.length];
    addrs.push({
      id: `test-addr-${cust.id}-0`,
      customerId: cust.id,
      label: primary[0],
      address: primary[1],
      zone: primary[3],
      isDefault: true,
      latitude: primary[4],
      longitude: primary[5],
      createdAt: now,
    });
    // Every 4th customer also gets a second (office/work) address from a different band
    if (ci % 4 === 0) {
      const secondary = ALL_ADDRS[(ci + 20) % ALL_ADDRS.length];
      addrs.push({
        id: `test-addr-${cust.id}-1`,
        customerId: cust.id,
        label: "Office",
        address: secondary[1],
        zone: secondary[3],
        isDefault: false,
        latitude: secondary[4],
        longitude: secondary[5],
        createdAt: now,
      });
    }
  });
  return addrs;
}

// ---------------------------------------------------------------------------
// Menu (2 weeks: current + next)
// ---------------------------------------------------------------------------

const MEAL_A_NAMES = ["Cơm Gà Kho Gừng", "Cơm Bò Lúc Lắc", "Cơm Cá Hồi Sốt Miso", "Cơm Heo Rang Mắm", "Cơm Gà Nướng Mật Ong"];
const MEAL_B_NAMES = ["Bún Bò Huế Chay", "Bún Gà Tiêu Xanh", "Bún Cá Lóc Sả", "Bún Heo Rau Sống", "Bún Thịt Nướng Cuộn"];

function makeMenuItems(weekLabel: string, weekOffset: number): MenuItem[] {
  const items: MenuItem[] = [];
  for (let day = 1; day <= 5; day++) {
    const aIdx = (day - 1 + weekOffset * 3) % MEAL_A_NAMES.length;
    const bIdx = (day - 1 + weekOffset * 2 + 2) % MEAL_B_NAMES.length;
    items.push({
      id: `${weekLabel}-${day}-1`,
      weekLabel,
      day,
      slot: 1,
      name: MEAL_A_NAMES[aIdx],
      description: null,
      calories: 450 + day * 20,
      protein: 30 + day * 2,
      goals: "cutting,maintenance",
    });
    items.push({
      id: `${weekLabel}-${day}-2`,
      weekLabel,
      day,
      slot: 2,
      name: MEAL_B_NAMES[bIdx],
      description: null,
      calories: 420 + day * 15,
      protein: 28 + day * 2,
      goals: "maintenance,bulking",
    });
  }
  return items;
}

function seedMenu(): void {
  const now = new Date();
  const thisWeekLabel = weekLabelForDate(now);
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  const nextWeekLabel = weekLabelForDate(nextWeek);
  const items = [...makeMenuItems(thisWeekLabel, 0), ...makeMenuItems(nextWeekLabel, 1)];
  writeRows("menu.xlsx", "Menu", items);
}

// Hub default: 10.7769, 106.7009 (District 1, HCMC)
// Addresses spread at 4 distance bands: <3km / 3-7km / 7-12km / >12km
// Each entry: [label, street address, district, zone, lat, lng]
type AddrTuple = [string, string, string, string, number, number];

// ── Near hub < 3 km ─────────────────────────────────────────────────────────
const NEAR_ADDRS: AddrTuple[] = [
  ["Home", "12 Nguyễn Huệ, Bến Nghé, Quận 1", "Quận 1", "Q1", 10.7737, 106.7033],
  ["Home", "56 Lê Lợi, Phường Bến Thành, Quận 1", "Quận 1", "Q1", 10.7726, 106.6981],
  ["Home", "78 Đinh Tiên Hoàng, Phường Đa Kao, Quận 1", "Quận 1", "Q1", 10.7869, 106.7009],
  ["Home", "34 Trần Hưng Đạo, Phường Nguyễn Cư Trinh, Quận 1", "Quận 1", "Q1", 10.7660, 106.6961],
  ["Home", "101 Lý Tự Trọng, Phường Bến Nghé, Quận 1", "Quận 1", "Q1", 10.7752, 106.7012],
  ["Home", "22 Võ Thị Sáu, Phường 7, Quận 3", "Quận 3", "Q3", 10.7845, 106.6892],
  ["Home", "88 Nam Kỳ Khởi Nghĩa, Phường 8, Quận 3", "Quận 3", "Q3", 10.7804, 106.6878],
  ["Home", "15 Nguyễn Đình Chiểu, Phường 1, Quận 3", "Quận 3", "Q3", 10.7763, 106.6930],
  ["Home", "30 Tôn Đức Thắng, Bến Nghé, Quận 1", "Quận 1", "Q1", 10.7714, 106.7052],
  ["Home", "8 Hai Bà Trưng, Bến Nghé, Quận 1", "Quận 1", "Q1", 10.7780, 106.7018],
];

// ── Mid 3-7 km ───────────────────────────────────────────────────────────────
const MID_ADDRS: AddrTuple[] = [
  ["Home", "200 Lê Văn Sỹ, Phường 14, Quận 3", "Quận 3", "Q3", 10.7939, 106.6844],
  ["Home", "45 Phan Xích Long, Phường 3, Phú Nhuận", "Phú Nhuận", "PN", 10.7980, 106.6840],
  ["Home", "9 Hoàng Văn Thụ, Phường 8, Phú Nhuận", "Phú Nhuận", "PN", 10.8009, 106.6803],
  ["Home", "33 Nguyễn Trọng Tuyển, Phường 10, Phú Nhuận", "Phú Nhuận", "PN", 10.7952, 106.6762],
  ["Home", "120 Điện Biên Phủ, Phường 15, Bình Thạnh", "Bình Thạnh", "BT", 10.8051, 106.7098],
  ["Home", "55 Bạch Đằng, Phường 2, Bình Thạnh", "Bình Thạnh", "BT", 10.8011, 106.7122],
  ["Home", "72 Nguyễn Gia Trí, Phường 25, Bình Thạnh", "Bình Thạnh", "BT", 10.8089, 106.7199],
  ["Home", "14 Hoàng Diệu, Phường 10, Quận 4", "Quận 4", "Q4", 10.7611, 106.7000],
  ["Home", "39 Tôn Thất Thuyết, Phường 16, Quận 4", "Quận 4", "Q4", 10.7589, 106.7012],
  ["Home", "67 Trần Xuân Soạn, Phường Tân Kiểng, Quận 7", "Quận 7", "Q7", 10.7481, 106.7100],
  ["Home", "5 Lê Thánh Tôn, Phường Bến Nghé, Quận 1", "Quận 1", "Q1", 10.7760, 106.7071],
  ["Home", "200 Nguyễn Thị Minh Khai, Phường 6, Quận 3", "Quận 3", "Q3", 10.7792, 106.6905],
];

// ── Far 7-12 km ──────────────────────────────────────────────────────────────
const FAR_ADDRS: AddrTuple[] = [
  ["Home", "88 Cộng Hòa, Phường 4, Tân Bình", "Tân Bình", "TB", 10.8012, 106.6522],
  ["Home", "120 Trường Chinh, Phường 12, Tân Bình", "Tân Bình", "TB", 10.8155, 106.6478],
  ["Home", "44 Lê Trọng Tấn, Phường Tây Thạnh, Tân Phú", "Tân Phú", "TP", 10.7900, 106.6300],
  ["Home", "66 Gò Vấp, Phường 3, Gò Vấp", "Gò Vấp", "GV", 10.8330, 106.6832],
  ["Home", "18 Phan Văn Trị, Phường 5, Gò Vấp", "Gò Vấp", "GV", 10.8270, 106.6889],
  ["Home", "90 Nguyễn Văn Nghi, Phường 7, Gò Vấp", "Gò Vấp", "GV", 10.8199, 106.6811],
  ["Home", "15 Nguyễn Thị Thập, Phường Tân Phú, Quận 7", "Quận 7", "Q7", 10.7310, 106.7050],
  ["Home", "30 Huỳnh Tấn Phát, Phường Phú Thuận, Quận 7", "Quận 7", "Q7", 10.7260, 106.7120],
  ["Home", "45 Lý Chiêu Hoàng, Phường 10, Quận 6", "Quận 6", "Q6", 10.7530, 106.6380],
  ["Home", "77 Hậu Giang, Phường 11, Quận 6", "Quận 6", "Q6", 10.7480, 106.6420],
];

// ── Very far > 12 km ─────────────────────────────────────────────────────────
const VFAR_ADDRS: AddrTuple[] = [
  ["Home", "100 Tô Ký, Phường Trung Mỹ Tây, Quận 12", "Quận 12", "Q12", 10.8620, 106.6411],
  ["Home", "55 Hà Huy Giáp, Phường Thạnh Lộc, Quận 12", "Quận 12", "Q12", 10.8701, 106.6530],
  ["Home", "23 Lê Văn Việt, Phường Hiệp Phú, Thủ Đức", "Thủ Đức", "TD", 10.8450, 106.7720],
  ["Home", "88 Võ Văn Ngân, Phường Bình Thọ, Thủ Đức", "Thủ Đức", "TD", 10.8519, 106.7601],
  ["Home", "12 Lê Văn Lương, Phước Kiểng, Nhà Bè", "Nhà Bè", "NB", 10.6951, 106.7221],
  ["Home", "34 Nguyễn Hữu Thọ, Phường Tân Hưng, Quận 7", "Quận 7", "Q7", 10.7150, 106.7020],
  ["Home", "90 An Dương Vương, Phường An Lạc, Bình Tân", "Bình Tân", "BTan", 10.7530, 106.6050],
  ["Home", "120 Kinh Dương Vương, Phường 12, Bình Tân", "Bình Tân", "BTan", 10.7489, 106.6000],
];

const ALL_ADDRS: AddrTuple[] = [...NEAR_ADDRS, ...MID_ADDRS, ...FAR_ADDRS, ...VFAR_ADDRS];

const FAKE_CUSTOMERS: Array<{ phone: string; name: string; notes?: string }> = [
  { phone: "0901000001", name: "Nguyễn Minh An" },
  { phone: "0901000002", name: "Trần Thị Lan" },
  { phone: "0901000003", name: "Lê Văn Tuấn" },
  { phone: "0901000004", name: "Phạm Thị Mai" },
  { phone: "0901000005", name: "Hoàng Đức Hùng" },
  { phone: "0901000006", name: "Vũ Thị Hoa" },
  { phone: "0901000007", name: "Đặng Văn Dũng" },
  { phone: "0901000008", name: "Bùi Thị Linh" },
  { phone: "0901000009", name: "Ngô Quốc Nam" },
  { phone: "0901000010", name: "Hồ Thị Thảo" },
  { phone: "0901000011", name: "Dương Minh Khoa", notes: "Không ăn hải sản" },
  { phone: "0901000012", name: "Lý Thị Ngọc" },
  { phone: "0901000013", name: "Phan Văn Long" },
  { phone: "0901000014", name: "Trịnh Thị Thu" },
  { phone: "0901000015", name: "Đinh Quang Bảo" },
  { phone: "0901000016", name: "Võ Thị Trang", notes: "Dị ứng đậu phộng" },
  { phone: "0901000017", name: "Nguyễn Văn Kiên" },
  { phone: "0901000018", name: "Trần Thị Hương" },
  { phone: "0901000019", name: "Lê Minh Quân" },
  { phone: "0901000020", name: "Phạm Thị Nhung" },
  { phone: "0901000021", name: "Huỳnh Văn Phúc" },
  { phone: "0901000022", name: "Đỗ Thị Phương" },
  { phone: "0901000023", name: "Cao Đức Anh", notes: "Ăn chay thứ 2 và thứ 6" },
  { phone: "0901000024", name: "Mai Thị Yến" },
  { phone: "0901000025", name: "Vũ Quang Hải" },
  { phone: "0901000026", name: "Nguyễn Thị Bích" },
  { phone: "0901000027", name: "Trần Văn Thắng" },
  { phone: "0901000028", name: "Lê Thị Kim Anh" },
  { phone: "0901000029", name: "Phạm Quốc Việt" },
  { phone: "0901000030", name: "Hoàng Thị Cúc" },
  // inactive customers (31–50)
  { phone: "0901000031", name: "Đặng Minh Tú" },
  { phone: "0901000032", name: "Bùi Văn Hòa" },
  { phone: "0901000033", name: "Ngô Thị Diễm" },
  { phone: "0901000034", name: "Hồ Văn Sơn" },
  { phone: "0901000035", name: "Dương Thị Lệ" },
  { phone: "0901000036", name: "Lý Quốc Trung" },
  { phone: "0901000037", name: "Phan Thị Nga" },
  { phone: "0901000038", name: "Trịnh Văn Hiếu" },
  { phone: "0901000039", name: "Đinh Thị Xuân" },
  { phone: "0901000040", name: "Võ Minh Đạt" },
  { phone: "0901000041", name: "Nguyễn Thị Hằng" },
  { phone: "0901000042", name: "Trần Quang Trung" },
  { phone: "0901000043", name: "Lê Thị Mỹ Duyên" },
  { phone: "0901000044", name: "Phạm Văn Tài" },
  { phone: "0901000045", name: "Huỳnh Thị Loan" },
  { phone: "0901000046", name: "Đỗ Văn Khải" },
  { phone: "0901000047", name: "Cao Thị Bảo Châu" },
  { phone: "0901000048", name: "Mai Văn Lợi" },
  { phone: "0901000049", name: "Vũ Thị Thanh Hà" },
  { phone: "0901000050", name: "Nguyễn Đức Toàn" },
];

function makeCustomers(phones: string[]): Customer[] {
  const now = new Date();
  return phones.map((phone, i) => {
    const fc = FAKE_CUSTOMERS.find((f) => f.phone === phone)!;
    const createdAt = new Date(now.getTime() - (phones.length - i) * 5 * 86400000).toISOString();
    return {
      id: phone,
      name: fc.name,
      phone,
      address: ALL_ADDRS[i % ALL_ADDRS.length][1],
      zone: ALL_ADDRS[i % ALL_ADDRS.length][3],
      notes: fc.notes ?? null,
      createdAt,
    };
  });
}

function makeSub(
  customerId: string,
  overrides: Partial<Omit<Subscription, "id" | "customerId" | "createdAt">>
): Subscription {
  const now = new Date().toISOString();
  return {
    id: `test-sub-${customerId}`,
    customerId,
    plan: "monthly",
    goal: "maintenance",
    mealsPerDay: 1,
    status: "active",
    shippingPrice: 50000,
    subscriptionPrice: 1000000,
    discount: 0,
    trialDays: null,
    startDate: daysFromNow(-20),
    endDate: daysFromNow(10),
    endDateNoSkip: daysFromNow(10),
    cancelReason: null,
    addressId: null,
    createdAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

function seedDefaultScenario() {
  seedScenario("default");
}

function seedScenario(id: ScenarioId) {
  // Ensure static files are present
  copyStaticFiles();
  clearTestSheets();

  if (id === "empty") {
    writeRows("customers.xlsx", "Customers", []);
    writeRows("subscriptions.xlsx", "Subscriptions", []);
    seedMenu();
    return;
  }

  if (id === "default") {
    const allPhones = FAKE_CUSTOMERS.map((f) => f.phone);
    const customers = makeCustomers(allPhones);
    writeRows("customers.xlsx", "Customers", customers);
    writeRows("addresses.xlsx", "Addresses", makeAddresses(customers));

    const goals: Array<"cutting" | "maintenance" | "bulking"> = ["cutting", "maintenance", "bulking"];
    const plans: Array<"weekly" | "monthly"> = ["weekly", "monthly"];

    // 30 active subscriptions (customers 01–30)
    const activeSubs: Subscription[] = Array.from({ length: 30 }, (_, i) => {
      const phone = `09010000${String(i + 1).padStart(2, "0")}`;
      const renewalDays = [2, 3, 5, 7, 8, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 26, 28, 30, 32, 35, 38, 40, 42, 45, 5, 7, 10, 15, 20][i];
      return makeSub(phone, {
        plan: plans[i % 2],
        goal: goals[i % 3],
        mealsPerDay: (i % 3 === 0) ? 2 : 1,
        subscriptionPrice: plans[i % 2] === "weekly" ? 700000 : 2600000,
        shippingPrice: [0, 30000, 50000, 0, 30000][i % 5],
        startDate: daysFromNow(-20 - (i % 10)),
        endDate: daysFromNow(renewalDays),
      });
    });

    // 20 inactive: 14 cancelled, 6 no subscription
    const inactiveSubs: Subscription[] = [
      makeSub("0901000031", { status: "cancelled", cancelReason: "Đi du lịch dài ngày", endDate: daysFromNow(-3) }),
      makeSub("0901000032", { status: "cancelled", cancelReason: "Tài chính", endDate: daysFromNow(-10) }),
      makeSub("0901000033", { status: "cancelled", cancelReason: "Không hài lòng", endDate: daysFromNow(-5) }),
      makeSub("0901000034", { status: "cancelled", cancelReason: "Chuyển nhà xa", endDate: daysFromNow(-20) }),
      makeSub("0901000035", { status: "cancelled", cancelReason: "Hết nhu cầu", endDate: daysFromNow(-1) }),
      makeSub("0901000036", { status: "cancelled", cancelReason: "Mang thai", endDate: daysFromNow(-8) }),
      makeSub("0901000037", { status: "cancelled", cancelReason: "Đổi chế độ ăn", endDate: daysFromNow(-15) }),
      makeSub("0901000038", { status: "cancelled", cancelReason: "Công việc bận rộn", endDate: daysFromNow(-7) }),
      makeSub("0901000039", { status: "cancelled", endDate: daysFromNow(-10) }),
      makeSub("0901000040", { status: "cancelled", endDate: daysFromNow(-14) }),
      makeSub("0901000041", { status: "cancelled", endDate: daysFromNow(-20) }),
      makeSub("0901000042", { status: "cancelled", endDate: daysFromNow(-8) }),
      makeSub("0901000043", { status: "cancelled", endDate: daysFromNow(-5) }),
      makeSub("0901000044", { status: "cancelled", endDate: daysFromNow(-30) }),
      // 45–50: no subscription (no entry added)
    ];

    writeRows("subscriptions.xlsx", "Subscriptions", [...activeSubs, ...inactiveSubs]);
    seedMenu();
    return;
  }

  if (id === "expiring-soon") {
    const phones = FAKE_CUSTOMERS.slice(0, 30).map((f) => f.phone);
    const customers = makeCustomers(phones);
    writeRows("customers.xlsx", "Customers", customers);
    writeRows("addresses.xlsx", "Addresses", makeAddresses(customers));

    const subs: Subscription[] = phones.map((phone, i) =>
      makeSub(phone, {
        plan: i % 2 === 0 ? "weekly" : "monthly",
        goal: (["cutting", "maintenance", "bulking"] as const)[i % 3],
        mealsPerDay: i % 3 === 0 ? 2 : 1,
        endDate: daysFromNow(i % 4),
      })
    );
    writeRows("subscriptions.xlsx", "Subscriptions", subs);
    seedMenu();
    return;
  }

  if (id === "all-active") {
    const allPhones = FAKE_CUSTOMERS.map((f) => f.phone);
    const customers = makeCustomers(allPhones);
    writeRows("customers.xlsx", "Customers", customers);
    writeRows("addresses.xlsx", "Addresses", makeAddresses(customers));

    const subs: Subscription[] = allPhones.map((phone, i) =>
      makeSub(phone, {
        plan: i % 2 === 0 ? "weekly" : "monthly",
        goal: (["cutting", "maintenance", "bulking"] as const)[i % 3],
        mealsPerDay: i % 3 === 0 ? 2 : 1,
        subscriptionPrice: i % 2 === 0 ? 700000 : 2600000,
        endDate: daysFromNow(5 + (i % 30)),
      })
    );
    writeRows("subscriptions.xlsx", "Subscriptions", subs);
    seedMenu();
    return;
  }
}
