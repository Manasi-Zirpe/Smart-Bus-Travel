// server.js
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const fs = require('fs');

const app = express();
const port = 3000;

// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- Create uploads directory if it doesn't exist ----------
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// ---------- MySQL Connection ----------
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adi@pz01',
    database: 'sbt_db'
});

db.connect(err => {
    if (err) {
        console.error('DB connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database');
    initializeDatabase();
});

// ---------- Initialize Database Tables ----------
function initializeDatabase() {
    // Users table
    db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            first VARCHAR(100) NOT NULL,
            last VARCHAR(100) NOT NULL,
            accountMethod VARCHAR(20) NOT NULL,
            account VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'not_submitted',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating users table:', err);
        else console.log('Users table ready');
    });

    // Student form table
    db.query(`
        CREATE TABLE IF NOT EXISTS student_form (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            stu_name VARCHAR(255) NOT NULL,
            stu_college VARCHAR(255) NOT NULL,
            stu_email VARCHAR(255) NOT NULL,
            stu_college_email VARCHAR(255),
            stu_course VARCHAR(255),
            stu_dob DATE,
            stu_phone VARCHAR(20),
            stu_address TEXT,
            start_point VARCHAR(255),
            dest_point VARCHAR(255),
            duration INT,
            aadhar_number VARCHAR(20),
            photo VARCHAR(255),
            aadhar VARCHAR(255),
            bonafide VARCHAR(255),
            lightbill VARCHAR(255),
            feesreceipt VARCHAR(255),
            verification_status VARCHAR(50) DEFAULT 'pending',
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Error creating student_form table:', err);
        else console.log('Student form table ready');
    });

    // Pass selection table
    db.query(`
        CREATE TABLE IF NOT EXISTS pass_selection (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            months INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            selected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Error creating pass_selection table:', err);
        else console.log('Pass selection table ready');
    });

    // Payments table
    db.query(`
        CREATE TABLE IF NOT EXISTS payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            payment_method VARCHAR(50),
            upi_id VARCHAR(255),
            payment_status VARCHAR(50) DEFAULT 'pending',
            paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Error creating payments table:', err);
        else console.log('Payments table ready');
    });
}

// ---------- Email Configuration (nodemailer) ----------


// ---------- Email Configuration (Ethereal Fake SMTP) ----------

// Create Ethereal test account and transporter
// ---------- Email Configuration (Ethereal Fake SMTP) ----------


// Create a Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'zirpemanasi@gmail.com',
    pass: 'qrck beyz sowd kuhx'
  }
});


// ---------- Multer setup for file uploads ----------
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images and PDFs only
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only image and PDF files are allowed'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: fileFilter
});

// ---------- Signup API ----------
app.post('/signup', (req, res) => {
    const { first, last, accountMethod, account, password } = req.body;

    if (!first || !last || !account || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    db.query('SELECT * FROM users WHERE account = ?', [account], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        if (results.length > 0) {
            return res.status(400).json({ message: 'Account already exists' });
        }

        const createdAt = new Date();
        db.query(
            'INSERT INTO users (first, last, accountMethod, account, password, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [first, last, accountMethod, account, password, 'not_submitted', createdAt],
            (err, result) => {
                if (err) {
                    console.error('Insert error:', err);
                    return res.status(500).json({ message: 'Failed to create account', error: err.message });
                }
                res.json({ message: 'Account created successfully', userId: result.insertId.toString() });
            }
        );
    });
});

// ---------- Login API ----------
app.post('/login', (req, res) => {
    const { account, password } = req.body;

    if (!account || !password) {
        return res.status(400).json({ message: 'Email/phone and password are required' });
    }

    db.query('SELECT * FROM users WHERE account = ? AND password = ?', [account, password], (err, users) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = users[0];
        user.id = user.id.toString(); // Convert to string for consistency
        
        // Fetch student form data
        db.query('SELECT * FROM student_form WHERE user_id = ?', [user.id], (err2, forms) => {
            if (err2) {
                console.error('Database error:', err2);
                return res.status(500).json({ message: 'Database error', error: err2.message });
            }

            if (forms.length > 0) {
                user.student = forms[0];
            }
            
            res.json({ message: 'Login successful', user });
        });
    });
});


// ---------- Submit Student Form API ----------
// ---------- Submit Student Form API ----------
app.post('/submit-form', upload.fields([
    { name: 'photo', maxCount: 1 }, 
    { name: 'aadhar', maxCount: 1 }, 
    { name: 'bonafide', maxCount: 1 }, 
    { name: 'lightbill', maxCount: 1 }, 
    { name: 'feesreceipt', maxCount: 1 }
]), (req, res) => {
    const body = req.body;
    const files = req.files;

    console.log('Form submission received - Body:', body);
    console.log('Form submission received - Files:', files);

    if (!body.user_id) {
        console.log('Missing user_id in form submission');
        return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Check if required fields are present
    const requiredFields = ['stu_name', 'stu_college', 'stu_email', 'stu_dob', 'stu_phone'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
        console.log('Missing required fields:', missingFields);
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: ' + missingFields.join(', ') 
        });
    }

    const data = [
        body.user_id,
        body.stu_name,
        body.stu_college,
        body.stu_email,
        body.stu_college_email || '',
        body.stu_course || '',
        body.stu_dob,
        body.stu_phone,
        body.stu_address || '',
        body.start_point || '',
        body.dest_point || '',
        body.duration || 1,
        body.aadharNumber || '',
        files.photo ? files.photo[0].filename : null,
        files.aadhar ? files.aadhar[0].filename : null,
        files.bonafide ? files.bonafide[0].filename : null,
        files.lightbill ? files.lightbill[0].filename : null,
        files.feesreceipt ? files.feesreceipt[0].filename : null
    ];

    console.log('Processed data for DB:', data);

    // Check if user already has a form submitted
    db.query('SELECT * FROM student_form WHERE user_id = ?', [body.user_id], (err, existing) => {
        if (err) {
            console.error('Database error checking existing form:', err);
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }

        const query = existing.length > 0
            ? `UPDATE student_form 
               SET stu_name=?, stu_college=?, stu_email=?, stu_college_email=?, stu_course=?, stu_dob=?, stu_phone=?, stu_address=?, start_point=?, dest_point=?, duration=?, aadhar_number=?, photo=?, aadhar=?, bonafide=?, lightbill=?, feesreceipt=?, verification_status='pending'
               WHERE user_id=?`
            : `INSERT INTO student_form 
               (user_id, stu_name, stu_college, stu_email, stu_college_email, stu_course, stu_dob, stu_phone, stu_address, start_point, dest_point, duration, aadhar_number, photo, aadhar, bonafide, lightbill, feesreceipt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const queryData = existing.length > 0 
            ? [...data.slice(1), body.user_id]
            : data;

        console.log('Executing query:', query);
        console.log('With data:', queryData);

        db.query(query, queryData, (err, result) => {
            if (err) {
                console.error('Database error saving form:', err);
                return res.status(500).json({ success: false, message: 'Failed to submit form', error: err.message });
            }

            console.log('Form saved successfully, result:', result);

            // Update user's status
            db.query('UPDATE users SET status = ? WHERE id = ?', ['submitted', body.user_id], (err2) => {
                if (err2) {
                    console.error('Database error:', err2);
                    return res.status(500).json({ success: false, message: 'Failed to update status', error: err2.message });
                }

                // Send email notification (optional, may fail in development)
                const mailOptions = {
                    from: 'noreply@sbtbus.com',
                    to: [body.stu_email, body.stu_college_email].filter(Boolean),
                    subject: 'Bus Pass Application Submitted - SBT',
                   html: `
        <h2>Application Submitted Successfully</h2>
        <p>Dear ${body.stu_name},</p>
        <p>Received bus pass application successfully. Please verify if the student belongs to your college: <strong>${body.stu_college}</strong>.</p>
        <p>Click below to approve or reject:</p>
        <a href="http://localhost:3000/college-action?formId=${result.insertId}&action=accept" style="padding:10px 20px; background-color:green; color:white; text-decoration:none; margin-right:10px;">Yes - Accept</a>
        <a href="http://localhost:3000/college-action?formId=${result.insertId}&action=reject" style="padding:10px 20px; background-color:red; color:white; text-decoration:none;">No - Reject</a>
        <br><br>
        <p>Best regards,<br>SBT Smart Bus Travel Team</p>
    `
};

                transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        console.error('Email error (non-critical):', err.message);
                    } else {
                        console.log('Verification email sent:', info.response);
                    }
                });

                res.json({ 
                    success: true, 
                    message: 'Form submitted successfully. Your application is pending verification from your college.',
                    formId: result.insertId
                });
            }); // Closing brace for db.query callback
        }); // Closing brace for db.query callback
    }); // Closing brace for db.query callback
}); // Closing brace for the route handler


// ---------- Get Application Status ----------
app.get('/application-status/:userId', (req, res) => {
    const userId = req.params.userId;

    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, users) => {
        if (err || users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        
        db.query('SELECT * FROM student_form WHERE user_id = ?', [userId], (err2, forms) => {
            if (err2) {
                return res.status(500).json({ message: 'Database error' });
            }

            res.json({
                status: user.status,
                form: forms.length > 0 ? forms[0] : null
            });
        });
    });
});

// ---------- Select Pass API ----------
app.post('/select-pass', (req, res) => {
    const { user_id, months, amount } = req.body;

    if (!user_id || !months || !amount) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if pass already selected, update or insert
    db.query('SELECT * FROM pass_selection WHERE user_id = ?', [user_id], (err, existing) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        const query = existing.length > 0
            ? 'UPDATE pass_selection SET months = ?, amount = ? WHERE user_id = ?'
            : 'INSERT INTO pass_selection (months, amount, user_id) VALUES (?, ?, ?)';

        db.query(query, [months, amount, user_id], (err2) => {
            if (err2) {
                console.error('Database error:', err2);
                return res.status(500).json({ success: false, message: 'Failed to save pass selection' });
            }
 
                res.json({ 
                success: true, 
                message: months + ' month pass selected. Please proceed to payment.' 
              }); 
            });
        });
    });

// ---------- Process Payment API ----------
app.post('/process-payment', (req, res) => {
    const { user_id, amount, payment_method, upi_id } = req.body;

    if (!user_id || !amount) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // In production, integrate with actual payment gateway
    // For demo, we'll simulate successful payment
    db.query(
        'INSERT INTO payments (user_id, amount, payment_method, upi_id, payment_status) VALUES (?, ?, ?, ?, ?)',
        [user_id, amount, payment_method || 'demo', upi_id || null, 'completed'],
        (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, message: 'Payment processing failed' });
            }

            // Update user status to paid
            db.query('UPDATE users SET status = ? WHERE id = ?', ['paid', user_id], (err2) => {
                if (err2) {
                    console.error('Database error:', err2);
                }

                res.json({ 
                    success: true, 
                    message: 'Payment successful! Generating your pass...',
                    paymentId: result.insertId
                });
            });
        }
    );
});

// ---------- Get Complete User Data (for pass generation) ----------
app.get('/user-complete/:userId', (req, res) => {
    const userId = req.params.userId;

    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, users) => {
        if (err || users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        
        db.query('SELECT * FROM student_form WHERE user_id = ?', [userId], (err2, forms) => {
            if (err2) {
                return res.status(500).json({ message: 'Database error' });
            }

            db.query('SELECT * FROM pass_selection WHERE user_id = ?', [userId], (err3, passes) => {
                if (err3) {
                    return res.status(500).json({ message: 'Database error' });
                }

                res.json({
                    user,
                    form: forms.length > 0 ? forms[0] : null,
                    pass: passes.length > 0 ? passes[0] : null
                });
            });
        });
    });
});

// ---------- Error handling middleware ----------
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error', 
        error: err.message 
    });
});

// ---------- Start server ----------
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Upload directory: ${path.join(__dirname, 'uploads')}`);
});


// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nClosing database connection...');
    db.end();
    process.exit(0);
});