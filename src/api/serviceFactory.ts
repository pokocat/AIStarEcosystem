import type {
  CoachDashboardData,
  FanDashboardData,
  IAppService,
  ProducerDashboardData,
} from './interfaces/IAppService';
import {
  MOCK_COACH_DATA,
  MOCK_FAN_DATA,
  MOCK_PRODUCER_DATA,
} from '../data/mockData';

class MockAppService implements IAppService {
  async getProducerData(_userId: string): Promise<ProducerDashboardData> {
    return structuredClone(MOCK_PRODUCER_DATA);
  }

  async getFanData(_userId: string): Promise<FanDashboardData> {
    return structuredClone(MOCK_FAN_DATA);
  }

  async getCoachData(_userId: string): Promise<CoachDashboardData> {
    return structuredClone(MOCK_COACH_DATA);
  }
}

class LiveAppService implements IAppService {
  // 预留：Phase 3 接入真实 API
  async getProducerData(_userId: string): Promise<ProducerDashboardData> {
    throw new Error('LiveAppService.getProducerData not implemented yet.');
  }

  async getFanData(_userId: string): Promise<FanDashboardData> {
    throw new Error('LiveAppService.getFanData not implemented yet.');
  }

  async getCoachData(_userId: string): Promise<CoachDashboardData> {
    throw new Error('LiveAppService.getCoachData not implemented yet.');
  }
}

export const createAppService = (): IAppService => {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
  return useMock ? new MockAppService() : new LiveAppService();
};

export const appService = createAppService();
