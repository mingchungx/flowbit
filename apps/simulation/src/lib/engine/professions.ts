import type { Profession } from "./types";

export interface ProfessionConfig {
  name: Profession;
  label: string;
  priceRange: [number, number];  // service price range
  needs: Profession[];           // what this profession typically hires
}

export const PROFESSIONS: ProfessionConfig[] = [
  { name: "developer", label: "Developer", priceRange: [40, 80], needs: ["designer", "writer", "security-auditor"] },
  { name: "designer", label: "Designer", priceRange: [35, 70], needs: ["developer", "photographer", "writer"] },
  { name: "writer", label: "Writer", priceRange: [20, 50], needs: ["designer", "marketer", "researcher"] },
  { name: "data-analyst", label: "Data Analyst", priceRange: [45, 85], needs: ["developer", "researcher", "accountant"] },
  { name: "security-auditor", label: "Security Auditor", priceRange: [60, 100], needs: ["developer", "lawyer", "researcher"] },
  { name: "accountant", label: "Accountant", priceRange: [30, 60], needs: ["lawyer", "developer", "writer"] },
  { name: "chef", label: "Chef", priceRange: [15, 35], needs: ["driver", "accountant", "photographer"] },
  { name: "driver", label: "Driver", priceRange: [10, 25], needs: ["mechanic", "accountant", "plumber"] },
  { name: "doctor", label: "Doctor", priceRange: [80, 150], needs: ["accountant", "lawyer", "researcher"] },
  { name: "lawyer", label: "Lawyer", priceRange: [70, 130], needs: ["accountant", "researcher", "writer"] },
  { name: "teacher", label: "Teacher", priceRange: [20, 45], needs: ["writer", "designer", "developer"] },
  { name: "mechanic", label: "Mechanic", priceRange: [25, 55], needs: ["electrician", "driver", "accountant"] },
  { name: "plumber", label: "Plumber", priceRange: [30, 60], needs: ["electrician", "driver", "accountant"] },
  { name: "electrician", label: "Electrician", priceRange: [35, 65], needs: ["plumber", "mechanic", "accountant"] },
  { name: "photographer", label: "Photographer", priceRange: [25, 55], needs: ["designer", "marketer", "driver"] },
  { name: "musician", label: "Musician", priceRange: [15, 40], needs: ["marketer", "photographer", "writer"] },
  { name: "marketer", label: "Marketer", priceRange: [35, 70], needs: ["writer", "designer", "data-analyst"] },
  { name: "researcher", label: "Researcher", priceRange: [40, 80], needs: ["data-analyst", "writer", "developer"] },
  { name: "architect", label: "Architect", priceRange: [50, 95], needs: ["electrician", "plumber", "designer"] },
  { name: "therapist", label: "Therapist", priceRange: [45, 85], needs: ["accountant", "writer", "musician"] },
];
