import axios, { AxiosError } from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface PaymentIntent {
  intent_type: 'PAYMENT' | 'BALANCE_INQUIRY' | 'TRANSACTION_HISTORY';
  amount?: number | null;
  currency: string;
  merchant_vpa?: string | null;
  confidence_score: number;
  raw_input: string;
}

export interface CommandResponse {
  status: string;
  message: string;
  intent?: PaymentIntent;
  policy_decision?: string;
  execution_result?: any;
  risk_info?: {
    score: number;
    violations: string[];
  };
}

export const processCommand = async (text: string, userId: string = 'user_default'): Promise<CommandResponse> => {
  try {
    const response = await apiClient.post<CommandResponse>('/process-command', {
      text,
      user_id: userId,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>; // Use precise type if possible
      // Return a structured error response that the UI can handle
      return {
        status: 'error',
        message: axiosError.response?.data?.detail || axiosError.message || 'Network Error',
        policy_decision: 'ERROR'
      };
    }
    throw error;
  }
};
