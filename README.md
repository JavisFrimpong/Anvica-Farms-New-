# Anvica Farms — Premium Poultry E-commerce

Anvica Farms is a modern e-commerce platform dedicated to providing fresh, high-quality poultry products from farm to table. Located in Amasaman, Accra, the farm prides itself on sustainable practices and premium quality.

## 🚀 Features

### **Storefront**
- **Premium UI**: Modern, responsive design with glassmorphism effects and professional poultry photography.
- **Dynamic Catalog**: Real-time product listing with categories (Live Birds, Eggs, etc.).
- **Smart Shopping Cart**: Persistent cart with quantity management and live total calculation.
- **Enhanced Checkout**: A two-step checkout process featuring an order preview modal for customer confirmation.
- **Location Awareness**: Integrated farm location and contact details for transparency.

### **Admin Dashboard**
- **Secure Authentication**: Admin login and signup via Supabase Auth.
- **Comprehensive Management**: Full CRUD operations (Create, Read, Update, Delete) for products.
- **Order Tracking**: Detailed view of customer orders with status management.
- **Live Stats**: At-a-glance dashboard showing total products, orders, and revenue.
- **Image Uploads**: Support for local file selection or direct camera capture for product images (stored in Supabase Storage).

## 🛠️ Tech Stack

### **Frontend**
- **HTML5 & CSS3**: Custom styles with a focus on premium aesthetics and mobile responsiveness.
- **JavaScript (ES6+)**: Vanilla JS for logic and DOM manipulation.
- **Icons**: Font Awesome 6.

### **Backend & Persistence**
- **Supabase**: 
  - **Authentication**: Secure admin access via Supabase Auth.
  - **Database**: PostgreSQL for products and orders.
  - **Storage**: Bucket-based storage for product images.
- **Node.js & Express**: Backend server for serving static files and email notifications.
- **Nodemailer**: Automated Gmail notifications for new orders.

## 📦 Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone [repository-url]
   cd Anvica-Farms-New-
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   EMAIL_USER=your_gmail@gmail.com
   EMAIL_PASS=your_gmail_app_password
   ```

4. **Supabase Configuration**:
   Update the Supabase URL and anon key in `public/js/supabase-config.js` with your project credentials. Make sure the following tables exist in your Supabase project:
   - **products**: `id`, `name`, `description`, `price`, `category`, `image`, `in_stock`, `created_at`, `updated_at`
   - **orders**: `id`, `order_number`, `customer_name`, `customer_phone`, `customer_address`, `items` (jsonb), `total`, `status`, `created_at`

5. **Start the server**:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `/public` — Frontend assets (HTML, CSS, JS, Images)
- `/public/js/supabase-config.js` — Supabase connection config
- `/public/js/app.js` — Storefront logic
- `/public/js/admin.js` — Admin dashboard logic
- `/server.js` — Node.js server (static files + email notifications)

---
© 2026 Anvica Farms. Fresh Poultry, Always.