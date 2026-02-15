import apiService from './api';
import idbService from './idbService';

export const dataService = {
  ...apiService,
  ...idbService,
};
export default dataService;

export * from './api';
