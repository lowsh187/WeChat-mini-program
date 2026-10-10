import { RolePreview } from '../models/frontend';
// Local presentation IDs only; B must confirm business role IDs.
export const roles: RolePreview[] = [
  { localId: 'ui-data', name: '数据分析', introduction: '整理事实、比较变化，为判断提供依据。真实工作还包括数据质量与业务沟通。' },
  { localId: 'ui-operations', name: '产品运营', introduction: '理解用户，设计活动并验证效果。真实工作还包括持续执行与跨团队协作。' },
  { localId: 'ui-research', name: '用户研究', introduction: '从访谈与观察中理解需求。真实工作还包括研究设计、招募与证据验证。' },
  { localId: 'ui-product', name: '产品经理', introduction: '识别问题、确定优先级并协调实现。' },
  { localId: 'ui-project', name: '项目管理', introduction: '协调目标、资源、进度和风险。' },
  { localId: 'ui-content', name: '内容策划', introduction: '面向目标受众设计内容角度与表达。' },
];
