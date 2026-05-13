const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ================= MIDDLEWARE =================

app.use(express.json());

// Enhanced CORS configuration for Render deployment
app.use(cors({
    origin: [
        'https://tw-project-27-23-61.onrender.com',  // Your frontend URL
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.static("public"));

// Health check endpoint (useful for Render)
app.get("/", (req, res) => {
    res.json({
        status: "Server is running",
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
    });
});

// ================= MONGODB CONNECTION =================

// Check if MONGO_URI exists
if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not defined in environment variables!");
    process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => {
        console.error("❌ MongoDB Connection Error:", err);
        // Don't exit, let the server run but log the error
    });

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// ================= SCHEMAS =================

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

const noteSchema = new mongoose.Schema({
    username: { type: String, required: true },
    text: { type: String, required: true },
    x: { type: Number, default: 100 },
    y: { type: Number, default: 120 },
    completed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Note = mongoose.model("Note", noteSchema);

const shareSchema = new mongoose.Schema({
    fromUser: { type: String, required: true },
    toUser: { type: String, required: true },
    text: { type: String, required: true },
    status: { type: String, default: "pending", enum: ["pending", "accepted", "rejected"] }
}, { timestamps: true });

const Share = mongoose.model("Share", shareSchema);

// ================= SIGNUP =================

app.post("/signup", async (req, res) => {
    try {
        const { name, username, password } = req.body;

        // Validation
        if (!name || !username || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Username already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, username, password: hashedPassword });
        await newUser.save();

        res.json({
            success: true,
            message: "Signup successful"
        });

    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});

// ================= LOGIN =================

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid password"
            });
        }

        res.json({
            success: true,
            message: "Login successful",
            user: {
                name: user.name,
                username: user.username
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});

// ================= ADD NOTE =================

app.post("/add-note", async (req, res) => {
    try {
        const { username, text } = req.body;

        if (!username || !text) {
            return res.status(400).json({
                success: false,
                message: "Username and text are required"
            });
        }

        const randomX = Math.floor(Math.random() * 900) + 50;
        const randomY = Math.floor(Math.random() * 500) + 120;

        const newNote = new Note({ username, text, x: randomX, y: randomY });
        await newNote.save();

        res.json({ success: true, message: "Task Added" });

    } catch (error) {
        console.error("Add note error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ================= GET ACTIVE NOTES =================

app.get("/get-notes/:username", async (req, res) => {
    try {
        const notes = await Note.find({
            username: req.params.username,
            completed: false
        }).sort({ createdAt: -1 });

        res.json(notes);

    } catch (error) {
        console.error("Get notes error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ================= GET COMPLETED NOTES =================

app.get("/completed-notes/:username", async (req, res) => {
    try {
        const notes = await Note.find({
            username: req.params.username,
            completed: true
        }).sort({ createdAt: -1 });

        res.json(notes);

    } catch (error) {
        console.error("Get completed notes error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ================= MOVE NOTE =================

app.put("/move-note/:id", async (req, res) => {
    try {
        const { x, y } = req.body;
        await Note.findByIdAndUpdate(req.params.id, { x, y });
        res.json({ success: true });

    } catch (error) {
        console.error("Move note error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ================= COMPLETE NOTE =================

app.put("/complete-note/:id", async (req, res) => {
    try {
        await Note.findByIdAndUpdate(req.params.id, { completed: true });
        res.json({ success: true });

    } catch (error) {
        console.error("Complete note error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ================= DELETE NOTE =================

app.delete("/delete-note/:id", async (req, res) => {
    try {
        await Note.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Task Deleted" });

    } catch (error) {
        console.error("Delete note error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ================= SHARE TASK =================

app.post("/share-note", async (req, res) => {
    try {
        const { fromUser, toUser, text } = req.body;

        if (!fromUser || !toUser || !text) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const userExists = await User.findOne({ username: toUser });
        if (!userExists) {
            return res.status(400).json({
                success: false,
                message: "Receiver username not found"
            });
        }

        const newShare = new Share({ fromUser, toUser, text });
        await newShare.save();

        res.json({ success: true, message: "Task Shared Successfully" });

    } catch (error) {
        console.error("Share task error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ================= GET SHARED TASKS =================

app.get("/shared-tasks/:username", async (req, res) => {
    try {
        const tasks = await Share.find({
            toUser: req.params.username,
            status: "pending"
        });
        res.json(tasks);

    } catch (error) {
        console.error("Get shared tasks error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ================= ACCEPT SHARED TASK =================

app.post("/accept-task/:id", async (req, res) => {
    try {
        const shareTask = await Share.findById(req.params.id);
        if (!shareTask) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        const randomX = Math.floor(Math.random() * 900) + 50;
        const randomY = Math.floor(Math.random() * 500) + 120;

        const newNote = new Note({
            username: shareTask.toUser,
            text: shareTask.text,
            x: randomX,
            y: randomY
        });
        await newNote.save();

        shareTask.status = "accepted";
        await shareTask.save();

        res.json({ success: true });

    } catch (error) {
        console.error("Accept task error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ================= START SERVER =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 CORS enabled for frontend`);
    if (process.env.MONGO_URI) {
        console.log(`🔗 MongoDB URI is configured`);
    } else {
        console.log(`⚠️  MONGO_URI is not set! Please add it to environment variables.`);
    }
});