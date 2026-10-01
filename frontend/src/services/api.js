import axios from 'axios';

// Backend API Base URL from environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Health check service to verify backend connectivity.
 * @returns {Promise<{connected: boolean, data?: {status: string, service: string}, error?: string, url: string}>}
 */
export const checkHealth = async () => {
  try {
    const response = await apiClient.get('/api/health');
    return {
      connected: true,
      data: response.data,
      url: API_BASE_URL,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message || 'Unable to connect to backend',
      url: API_BASE_URL,
    };
  }
};

/**
 * Search candidate evidence for a claim via the TruthLens Evidence Orchestrator.
 * 
 * @param {Object} payload
 * @param {string} payload.claim - The core claim to retrieve evidence for
 * @param {string} [payload.country] - ISO country code (e.g., 'IN')
 * @param {string} [payload.language] - ISO language code (e.g., 'en')
 * @param {string} [payload.date] - Preset period ('today', 'yesterday', '24h', '48h', '7d', '30d')
 * @param {number} [payload.size] - Result count limit (1-100)
 * @param {string} [payload.jurisdiction] - Selected Indian jurisdiction
 * @returns {Promise<{success: boolean, data?: Object, error?: string, code?: string, status?: number}>}
 */
export const searchEvidence = async (payload) => {
  try {
    const response = await apiClient.post('/api/evidence/search', payload);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const errData = error.response?.data?.error;
    return {
      success: false,
      error: errData?.message || error.message || 'Unable to retrieve evidence candidates',
      code: errData?.code || 'NETWORK_ERROR',
      status: error.response?.status,
    };
  }
};

export default apiClient;
