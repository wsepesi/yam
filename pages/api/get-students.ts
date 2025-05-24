import type { NextApiRequest, NextApiResponse } from "next";

import type { Student } from "@/lib/types";

// Mock student data
const students: Student[] = [
  {
    First_Name: "John",
    Last_Name: "Doe",
    Default_Email: "wesepesi@gmail.com",
    University_ID: "12345",
  },
  {
    First_Name: "Jane",
    Last_Name: "Smith",
    Default_Email: "wesepesi@gmail.com",
    University_ID: "12346",
  },
  {
    First_Name: "Bob",
    Last_Name: "Johnson",
    Default_Email: "wesepesi@gmail.com",
    University_ID: "12347",
  },
];

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Student[]>
) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  // In a real application, you would fetch this from a database
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=300"
  );
  res.status(200).json(students);
}
