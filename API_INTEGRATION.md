# TripSync — API Integration Documentation

## Overview

This document specifies the integration between the **TripSync React Frontend** and the **FastAPI Backend / Supabase PostgreSQL Database**.

---

## Endpoint Summary Table

| Endpoint | Method | Purpose | Auth | DB Tables | Frontend Consumer | Status |
|---|---|---|---|---|---|---|
| `/api/profile/me` | GET | Fetch current logged-in user profile details | Public / Bearer | `profiles` | `HomePage.jsx` | Active |
| `/api/trips/current` | GET | Fetch active trip metadata | Public / Bearer | `trips` | `HomePage.jsx`, `TripCard.jsx` | Active |
| `/api/trips/{trip_id}` | GET | Fetch specific trip details by ID | Public / Bearer | `trips` | `HomePage.jsx`, `TripPage.jsx` | Active |
| `/api/trips/{trip_id}/members` | GET | Fetch travel group members for a trip | Public / Bearer | `trip_members` | `HomePage.jsx`, `GroupPage.jsx` | Active |
| `/api/trips/{trip_id}/itinerary` | GET | Fetch upcoming chronological itinerary items | Public / Bearer | `itinerary_items` | `HomePage.jsx`, `TripPage.jsx` | Active |
| `/api/trips/{trip_id}/itinerary/next` | GET | Fetch next immediate upcoming event | Public / Bearer | `itinerary_items` | `HomePage.jsx` | Active |
| `/api/trips/{trip_id}/bookings` | GET | Fetch connected bookings (flights, hotels, etc.) | Public / Bearer | `bookings` | `HomePage.jsx`, `BookingCard.jsx` | Active |
| `/api/trips/{trip_id}/documents` | GET | Fetch stored document metadata & offline readiness | Public / Bearer | `documents` | `HomePage.jsx`, `DocumentsPage.jsx` | Active |
| `/api/trips/{trip_id}/budget` | GET | Fetch budget overview & financial breakdown | Public / Bearer | `budgets` | `HomePage.jsx`, `FinancePanel.jsx` | Active |
| `/api/trips/{trip_id}/budget/summary` | GET | Fetch budget summary metrics | Public / Bearer | `budgets` | `FinancePanel.jsx` | Active |
| `/api/trips/{trip_id}/expenses` | GET | Fetch recorded trip expenses | Public / Bearer | `expenses` | `HomePage.jsx`, `PersonalExpenseCard.jsx` | Active |
| `/api/trips/{trip_id}/dashboard` | GET | Aggregate endpoint returning complete Dashboard payload | Public / Bearer | `profiles`, `trips`, `trip_members`, `bookings`, `itinerary_items`, `budgets`, `expenses`, `documents` | `HomePage.jsx` | Active |

---

## Detailed Endpoint Documentation

### 1. GET `/api/profile/me`
- **HTTP Method**: `GET`
- **Purpose**: Retrieves profile details for the active traveler.
- **Authentication**: Public for demo / Bearer token in production.
- **Parameters**: None.
- **Response Structure**:
  ```json
  {
    "id": "tanvi-user-id",
    "username": "tanvi",
    "full_name": "Tanvi",
    "home_city": "Mumbai"
  }
  ```
- **Database Tables Accessed**: `profiles`
- **Frontend Component**: `HomePage.jsx`
- **Error Cases**: Returns default fallback profile on DB connection error.
- **Status**: Verified & Active.

---

### 2. GET `/api/trips/current`
- **HTTP Method**: `GET`
- **Purpose**: Returns active trip information including route, start/end dates, and traveler count.
- **Authentication**: Public / Bearer.
- **Parameters**: None.
- **Response Structure**:
  ```json
  {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "title": "Mumbai → Delhi → Manali",
    "origin": "Mumbai",
    "destination": "Manali",
    "route": ["Mumbai", "Delhi", "Manali"],
    "start_date": "2026-09-12",
    "end_date": "2026-09-18",
    "dates_label": "12 – 18 Sep 2026",
    "status": "normal",
    "travelers_count": 5
  }
  ```
- **Database Tables Accessed**: `trips`
- **Frontend Component**: `HomePage.jsx`, `TripCard.jsx`
- **Status**: Verified & Active.

---

### 3. GET `/api/trips/{trip_id}/dashboard`
- **HTTP Method**: `GET`
- **Purpose**: Single aggregate payload fetching all trip, next event, bookings, budget, group, expenses, and document data required to render the Dashboard in one fast request.
- **Authentication**: Public / Bearer.
- **Parameters**: `trip_id` (path string, e.g. `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`).
- **Response Structure**:
  ```json
  {
    "profile": { ... },
    "current_trip": { ... },
    "next_event": { ... },
    "itinerary": [ ... ],
    "bookings": [ ... ],
    "budget": {
      "trip_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "total_budget": 40000.0,
      "total_spent": 31200.0,
      "at_risk": 6500.0,
      "remaining": 8800.0
    },
    "expenses": [ ... ],
    "group_members": [ ... ],
    "documents": [ ... ]
  }
  ```
- **Database Tables Accessed**: `profiles`, `trips`, `trip_members`, `bookings`, `itinerary_items`, `budgets`, `expenses`, `documents`.
- **Frontend Component**: `HomePage.jsx`
- **Status**: Verified & Active.

---

## Data Flow Architecture

```
React (HomePage.jsx)
       │
       ▼
Frontend API Layer (src/services/dashboardService.js)
       │
       ▼  HTTP / REST JSON
FastAPI Backend (backend/main.py -> routers/dashboard.py)
       │
       ▼  Supabase Python Client / PostgREST
Supabase PostgreSQL Database (schema.sql)
```

---

## Security & Environment Configuration

- Frontend credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are client-safe.
- Backend server credentials (`SUPABASE_SERVICE_ROLE_KEY`) are protected inside `backend/.env` and NEVER exposed to the browser.
- Row Level Security (RLS) policies enable secure row access per user/trip.
