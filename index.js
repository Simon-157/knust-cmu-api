const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = 3000;

const pool = new Pool({
  user: "simon",
  host: "knust-cmu.postgres.database.azure.com",
  database: "student_management",
  password: "MetGoog5427+",
  port: 5432,
  ssl:{
    rejectUnauthorized: false
  },
});


app.use(cors());
app.use(bodyParser.json());

// Get all students
app.get("/students", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM students");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add student
app.post("/students", async (req, res) => {
  const {
    first_name,
    last_name,
    date_of_birth,
    gender,
    email,
    phone,
    address,
  } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO students (first_name, last_name, date_of_birth, gender, email, phone_number, address) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [first_name, last_name, date_of_birth, gender, email, phone, address]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get student by ID
app.get("/students/:id", async (req, res) => {
  const studentId = req.params.id;
  try {
    const result = await pool.query(
      "SELECT * FROM students WHERE student_id = $1",
      [studentId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Student not found" });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error("Error fetching student by ID:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// update student records
app.patch("/students/:id", async (req, res) => {
  const studentId = req.params.id;
  const {
    first_name,
    last_name,
    date_of_birth,
    gender,
    email,
    phone_number,
    address,
  } = req.body;

  try {
    const updateQuery = `
      UPDATE students
      SET first_name = $1,
          last_name = $2,
          date_of_birth = $3,
          gender = $4,
          email = $5,
          phone_number = $6,
          address = $7
      WHERE student_id = $8
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      first_name,
      last_name,
      date_of_birth,
      gender,
      email,
      phone_number,
      address,
      studentId,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Student not found" });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete student
app.delete("/students/:id", async (req, res) => {
  const studentId = req.params.id;
  console.log(studentId);
  try {
    const result = await pool.query(
      "DELETE FROM students WHERE student_id = $1",
      [studentId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Student not found" });
    } else {
      res.json({ message: "Student deleted successfully" });
    }
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Get student grades by course
app.get("/student/:studentId/grades", async (req, res) => {
  const studentId = req.params.studentId;
  try {
    const result = await pool.query(`
      SELECT
        c.course_id,
        c.course_code,
        c.course_name,
        e.grade,
        g.grade_value
      FROM courses c
      LEFT JOIN enrollments e ON c.course_id = e.course_id
      LEFT JOIN grades g ON e.enrollment_id = g.enrollment_id
      WHERE e.student_id = $1;
    `, [studentId]);

    const grades = result.rows;
    res.json(grades);
  } catch (error) {
    console.error("Error fetching student grades:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// Get all courses with instructors, schedules, and total enrollments
app.get("/courses", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.course_id,
        c.course_code,
        c.course_name,
        c.credit_hours,
        c.department as course_department,
        cs.schedule_id,
        cs.day_of_week,
        cs.start_time,
        cs.end_time,
        cs.room_number,
        i.first_name as instructor_first_name,
        i.last_name as instructor_last_name,
        i.email as instructor_email,
        COUNT(e.enrollment_id) as total_enrollments
      FROM courses c
      LEFT JOIN class_schedules cs ON c.course_id = cs.course_id
      LEFT JOIN instructors i ON cs.instructor_id = i.instructor_id
      LEFT JOIN enrollments e ON c.course_id = e.course_id
      GROUP BY c.course_id, cs.schedule_id, i.instructor_id
    `);

    const courses = result.rows.reduce((acc, row) => {
      const existingCourse = acc.find((course) => course.course_id === row.course_id);

      if (!existingCourse) {
        acc.push({
          course_id: row.course_id,
          course_code: row.course_code,
          course_name: row.course_name,
          credit_hours: row.credit_hours,
          department: row.course_department,
          schedules: [
            {
              schedule_id: row.schedule_id,
              day_of_week: row.day_of_week,
              start_time: row.start_time,
              end_time: row.end_time,
              room_number: row.room_number,
            },
          ],
          instructors: [
            {
              first_name: row.instructor_first_name,
              last_name: row.instructor_last_name,
              email: row.instructor_email,
            },
          ],
          total_enrollments: row.total_enrollments,
        });
      } else {
        existingCourse.schedules.push({
          schedule_id: row.schedule_id,
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
          room_number: row.room_number,
        });

        existingCourse.instructors.push({
          first_name: row.instructor_first_name,
          last_name: row.instructor_last_name,
          email: row.instructor_email,
        });

        existingCourse.total_enrollments = row.total_enrollments;
      }

      return acc;
    }, []);

    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// Get course by ID
app.get("/courses/:id", async (req, res) => {
  const courseId = req.params.id;
  try {
    const result = await pool.query(
      "SELECT * FROM courses WHERE course_id = $1",
      [courseId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Course not found" });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error("Error fetching course by ID:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get all instructors
app.get("/instructors", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM instructors");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching instructors:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get instructor by ID
app.get("/instructors/:id", async (req, res) => {
  const instructorId = req.params.id;
  try {
    const result = await pool.query(
      "SELECT * FROM instructors WHERE instructor_id = $1",
      [instructorId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Instructor not found" });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error("Error fetching instructor by ID:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Enroll a student in a course
app.post("/enrollments", async (req, res) => {
  const { studentId, courseId, enrollmentDate } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO enrollments (student_id, course_id, enrollment_date) VALUES ($1, $2, $3) RETURNING *",
      [studentId, courseId, enrollmentDate]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error enrolling student in course:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add grade for a student's enrollment
app.post("/grades", async (req, res) => {
  const { enrollmentId, gradeValue } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO grades (enrollment_id, grade_value) VALUES ($1, $2) RETURNING *",
      [enrollmentId, gradeValue]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding grade for enrollment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get courses for a specific student
app.get("/students/:id/courses", async (req, res) => {
  const studentId = req.params.id;
  try {
    const result = await pool.query(
      "SELECT courses.course_id, courses.course_code, courses.course_name, courses.credit_hours, courses.department, enrollments.grade FROM courses JOIN enrollments ON courses.course_id = enrollments.course_id WHERE enrollments.student_id = $1",
      [studentId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching courses for student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get course grades for a specific course
app.get("/course/:courseId/grades", async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const result = await pool.query(`
      SELECT
        s.first_name || ' ' || s.last_name as student_name,
        g.grade_value,
        e.grade
      FROM students s
      JOIN enrollments e ON s.student_id = e.student_id
      JOIN grades g ON e.enrollment_id = g.enrollment_id
      WHERE e.course_id = $1
    `, [courseId]);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching course grades:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Get grades for a specific student
app.get("/students/:id/grades", async (req, res) => {
  const studentId = req.params.id;
  try {
    const result = await pool.query(
      "SELECT courses.course_id, courses.course_name, grades.grade_value FROM grades JOIN enrollments ON grades.enrollment_id = enrollments.enrollment_id JOIN courses ON enrollments.course_id = courses.course_id WHERE enrollments.student_id = $1",
      [studentId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching grades for student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a course for a specific student
app.post("/students/:id/courses", async (req, res) => {
  const studentId = req.params.id;
  const { courseId, enrollmentDate } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO enrollments (student_id, course_id, enrollment_date) VALUES ($1, $2, $3) RETURNING *",
      [studentId, courseId, enrollmentDate]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding course for student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a grade for a specific student
app.post("/students/:id/grades", async (req, res) => {
  const studentId = req.params.id;
  const { enrollmentId, gradeValue } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO grades (enrollment_id, grade_value) VALUES ($1, $2) RETURNING *",
      [enrollmentId, gradeValue]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding grade for student:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// students and their standing gpas and grade points
app.get("/students/overall", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        students.*, 
        COALESCE(SUM(grades.grade_value * courses.credit_hours) / NULLIF(SUM(courses.credit_hours), 0), 0) as overall_gpa,
        COALESCE(SUM(CASE
            WHEN grades.grade_value >= 90 THEN 4.0 * courses.credit_hours
            WHEN grades.grade_value >= 80 THEN 3.0 * courses.credit_hours
            WHEN grades.grade_value >= 70 THEN 2.0 * courses.credit_hours
            WHEN grades.grade_value >= 60 THEN 1.0 * courses.credit_hours
            ELSE 0.0
          END) / NULLIF(SUM(courses.credit_hours), 0), 0) as overall_grade_points
      FROM students
      LEFT JOIN enrollments ON students.student_id = enrollments.student_id
      LEFT JOIN grades ON enrollments.enrollment_id = grades.enrollment_id
      LEFT JOIN courses ON enrollments.course_id = courses.course_id
      GROUP BY students.student_id;
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching students with overall GPA:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// A student and his or her standing GPA and grade point
app.get("/student/:studentId/overall", async (req, res) => {
  const { studentId } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        students.*, 
        COALESCE(SUM(grades.grade_value * courses.credit_hours) / NULLIF(SUM(courses.credit_hours), 0), 0) as overall_gpa,
        COALESCE(SUM(CASE
            WHEN grades.grade_value >= 90 THEN 4.0 * courses.credit_hours
            WHEN grades.grade_value >= 80 THEN 3.0 * courses.credit_hours
            WHEN grades.grade_value >= 70 THEN 2.0 * courses.credit_hours
            WHEN grades.grade_value >= 60 THEN 1.0 * courses.credit_hours
            ELSE 0.0
          END) / NULLIF(SUM(courses.credit_hours), 0), 0) as overall_grade_points
      FROM students
      LEFT JOIN enrollments ON students.student_id = enrollments.student_id
      LEFT JOIN grades ON enrollments.enrollment_id = grades.enrollment_id
      LEFT JOIN courses ON enrollments.course_id = courses.course_id
      WHERE students.student_id = $1
      GROUP BY students.student_id;
    `, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching overall GPA for student ${studentId}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
