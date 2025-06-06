import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:3000").split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.get('/api/v1/status', (req, res) => {
  res.json({
    message: 'PlayChaCha API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Sports events endpoint (mock data for now)
app.get('/api/v1/sports/events', (req, res) => {
  const mockEvents = [
    {
      id: 1,
      sport: 'NFL',
      homeTeam: 'Chiefs',
      awayTeam: 'Bills',
      homeScore: 21,
      awayScore: 17,
      status: '3rd Quarter',
      league: 'NFL',
      live: true
    },
    {
      id: 2,
      sport: 'NBA',
      homeTeam: 'Lakers',
      awayTeam: 'Warriors',
      homeScore: 89,
      awayScore: 92,
      status: '4th Quarter',
      league: 'NBA',
      live: true
    },
    {
      id: 3,
      sport: 'Soccer',
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      homeScore: 2,
      awayScore: 1,
      status: "78'",
      league: 'La Liga',
      live: true
    }
  ];

  res.json({
    success: true,
    data: mockEvents,
    timestamp: new Date().toISOString()
  });
});

// User location endpoint
app.post('/api/v1/user/location', (req, res) => {
  const { latitude, longitude } = req.body;
  
  // Mock location-based language detection
  let language = 'en';
  let country = 'US';
  
  // Simple geo-based language assignment (mock)
  if (latitude && longitude) {
    if (latitude > 36 && latitude < 44 && longitude > -9 && longitude < 3) {
      language = 'es';
      country = 'ES';
    } else if (latitude > 42 && latitude < 51 && longitude > -5 && longitude < 8) {
      language = 'fr';
      country = 'FR';
    } else if (latitude > 47 && latitude < 55 && longitude > 5 && longitude < 15) {
      language = 'de';
      country = 'DE';
    }
  }
  
  res.json({
    success: true,
    data: {
      language,
      country,
      coordinates: { latitude, longitude }
    }
  });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join sports events room
  socket.join('sports-events');
  
  // Send initial sports data
  socket.emit('sports-update', {
    events: [
      { id: 1, homeScore: 21, awayScore: 17 },
      { id: 2, homeScore: 89, awayScore: 92 },
      { id: 3, homeScore: 2, awayScore: 1 }
    ]
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Simulate live score updates
setInterval(() => {
  const randomEvent = Math.floor(Math.random() * 3) + 1;
  const scoreUpdate = {
    eventId: randomEvent,
    homeScore: Math.floor(Math.random() * 100),
    awayScore: Math.floor(Math.random() * 100),
    timestamp: new Date().toISOString()
  };
  
  io.to('sports-events').emit('score-update', scoreUpdate);
}, 5000);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PlayChaCha Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

export default app;

