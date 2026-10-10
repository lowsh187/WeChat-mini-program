import { getMockFollowup, getMockInitialRecommendation, getMockTrial, submitMockTrial } from './mock-provider';
import { MockScenario } from '../models/frontend';
import { workTrials } from '../mocks/work-trials';

// Page-facing adapter, not a backend request contract. No answers leave the device.
export const frontendService = {
  getTrialOptions() { return workTrials.map((trial) => ({ localRoleId: trial.localRoleId, localTrialId: trial.localId, roleName: trial.roleName })); },
  getTrial(localRoleId: string, scenario: MockScenario = 'normal') { return getMockTrial(localRoleId, scenario); },
  submitTrial(localTrialId: string, scenario: MockScenario = 'normal') { return submitMockTrial(localTrialId, scenario); },
  getFollowup(round: number, scenario: MockScenario = 'normal') {
    return getMockFollowup(round, scenario);
  },
  getInitialRecommendation(scenario: MockScenario = 'normal') {
    return getMockInitialRecommendation(scenario);
  },
};
