import { getMasil } from '@/server/raw/masil';
export const masil = () => getMasil().dataset;
