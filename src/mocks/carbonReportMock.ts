export interface CarbonReportBasicInfo {
  organizationName: string;
  unifiedSocialCreditCode: string;
  registeredAddress: string;
  industryCategory: string;
  businessScope: string;
  legalRepresentative: string;
  preparerPhone: string;
  preparer: string;
  preparerDepartment: string;
  reviewer: string;
  boundaryDescription: string;
}

export interface CarbonReportRecord {
  carbonReportId: string;
  carbonTaskId: string;
  taskName: string;
  carbonSnapshotId: string;
  year: number;
  version: number;
  reportName: string;
  generatedAt: string;
  recentGroup: '7天内' | '30天内';
  organizationName: string;
  templateName: string;
  standardName: string;
  basicInfo?: CarbonReportBasicInfo;
}

const seedCarbonReports: CarbonReportRecord[] = [
  {
    carbonReportId: 'carbon-report-2026-0706-01',
    carbonTaskId: 'ct-2026',
    taskName: '2026年度组织温室气体核算',
    carbonSnapshotId: 'cs-2026-v1',
    year: 2026,
    version: 1,
    reportName: '企业温室气体排放报告202607061800',
    generatedAt: '2026-07-06 18:00:00',
    recentGroup: '7天内',
    organizationName: 'XX科技有限公司',
    templateName: '通用工业企业模板',
    standardName: 'GB/T 32150—2025',
  },
  {
    carbonReportId: 'carbon-report-2026-0704-01',
    carbonTaskId: 'ct-2026',
    taskName: '2026年度组织温室气体核算',
    carbonSnapshotId: 'cs-2026-v1',
    year: 2026,
    version: 1,
    reportName: '企业温室气体排放报告202607041030',
    generatedAt: '2026-07-04 10:30:00',
    recentGroup: '7天内',
    organizationName: 'XX科技有限公司',
    templateName: '通用工业企业模板',
    standardName: 'GB/T 32150—2025',
  },
  {
    carbonReportId: 'carbon-report-2026-0629-01',
    carbonTaskId: 'ct-2026',
    taskName: '2026年度组织温室气体核算',
    carbonSnapshotId: 'cs-2026-v1',
    year: 2026,
    version: 1,
    reportName: '企业温室气体排放报告202606291600',
    generatedAt: '2026-06-29 16:00:00',
    recentGroup: '30天内',
    organizationName: 'XX科技有限公司',
    templateName: '通用工业企业模板',
    standardName: 'GB/T 32150—2025',
  },
  {
    carbonReportId: 'carbon-report-2025-0701-01',
    carbonTaskId: 'ct-2025',
    taskName: '2025年度组织温室气体核算',
    carbonSnapshotId: 'cs-2025-v2',
    year: 2025,
    version: 2,
    reportName: '企业温室气体排放报告202507011500',
    generatedAt: '2025-07-01 15:00:00',
    recentGroup: '30天内',
    organizationName: 'XX科技有限公司',
    templateName: '通用工业企业模板',
    standardName: 'GB/T 32150—2025',
  },
];

export function listCarbonReportMocks() {
  return seedCarbonReports.map((report) => ({ ...report }));
}

export function createCarbonReportMock(input: {
  carbonTaskId: string;
  taskName: string;
  carbonSnapshotId: string;
  year: number;
  version: number;
  generatedAt: string;
  basicInfo?: CarbonReportBasicInfo;
}) {
  const compactTime = input.generatedAt.replace(/\D/g, '').slice(0, 12);
  return {
    carbonReportId: `carbon-report-${input.year}-${compactTime}`,
    carbonTaskId: input.carbonTaskId,
    taskName: input.taskName,
    carbonSnapshotId: input.carbonSnapshotId,
    year: input.year,
    version: input.version,
    reportName: `企业温室气体排放报告${compactTime}`,
    generatedAt: input.generatedAt,
    recentGroup: '7天内',
    organizationName: 'XX科技有限公司',
    templateName: '通用工业企业模板',
    standardName: 'GB/T 32150—2025',
    basicInfo: input.basicInfo,
  } satisfies CarbonReportRecord;
}
