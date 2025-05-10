import { NextApiRequest, NextApiResponse } from 'next';

import { Student } from '@/lib/types';

// Mock student data
const students: Student[] = [
  {
    First_Name: "John",
    Last_Name: "Doe",
    Default_Email: "wesepesi@gmail.com",
    University_ID: "12345"
  },
  {
    First_Name: "Jane",
    Last_Name: "Smith",
    Default_Email: "wesepesi@gmail.com",
    University_ID: "12346"
  },
  {
    First_Name: "Bob",
    Last_Name: "Johnson",
    Default_Email: "wesepesi@gmail.com",
    University_ID: "12347"
  }
];

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Student[]>
) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  // In a real application, you would fetch this from a database
  res.status(200).json(students);
} 