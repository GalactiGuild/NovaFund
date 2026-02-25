export interface Milestone {
  id: string;
  title: string;
  description: string;
  percentage: number;
  estimatedDate: string;
  // advanced validation metadata (optional)
  validationType?: 'manual' | 'oracle';
  oracleAddress?: string;
  oracleExpectedHash?: string;
  oracleDeadline?: string;
}

export interface ProjectFormData {
  // Step 1: Basics
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  
  // Step 2: Funding
  fundingGoal: number;
  duration: number; // in days
  walletAddress: string;
  
  // Step 3: Milestones
  milestones: Milestone[];
}

export interface ValidationErrors {
  [key: string]: string;
}

export const PROJECT_CATEGORIES = [
  'Technology',
  'Art & Design',
  'Social Impact',
  'Education',
  'Health & Wellness',
  'Environment',
  'Business',
  'Other'
] as const;

export const INITIAL_PROJECT_DATA: ProjectFormData = {
  title: '',
  description: '',
  category: '',
  imageUrl: '',
  fundingGoal: 0,
  duration: 30,
  walletAddress: '',
  milestones: []
};
