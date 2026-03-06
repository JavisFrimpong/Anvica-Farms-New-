// Store loaded products for cart reference
let productsMap = {};

// Fallback SVG logic removed as user requested no placeholder.
// Helper: Check if image is valid, completely rejecting corrupted SVGs with quotes
function isValidImageUrl(img) {
  if (!img || typeof img !== 'string' || img.trim() === '') return false;
  if (img.includes('<svg') || img.includes('utf8') || img.includes('base64')) return false;
  return true;
}

// =====================
// PRODUCTS GRID
// =====================
const productsGrid = document.getElementById("productsGrid");

async function loadProducts() {
  productsGrid.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;

  const { data: products, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  productsGrid.innerHTML = "";
  if (error || !products || products.length === 0) {
    productsGrid.innerHTML = `<p style="text-align:center; color:var(--text-light)">No products available yet. Check back soon!</p>`;
  } else {
    // Store products in map for safe reference
    products.forEach(prod => { productsMap[prod.id] = prod; });

    products.forEach(prod => {
      const hasValidImage = isValidImageUrl(prod.image);
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-image">
          ${hasValidImage ? `<img src="${prod.image.trim()}" alt="${prod.name}">` : `<div class="product-image-placeholder"><i class="fas fa-drumstick-bite"></i></div>`}
          <span class="category-tag">${prod.category || 'General'}</span>
          ${!prod.in_stock ? `<div class="out-of-stock"><span>Out of Stock</span></div>` : ''}
        </div>
        <div class="product-info">
          <h3 class="product-name">${prod.name}</h3>
          <p class="product-desc">${prod.description || ''}</p>
          <div class="product-footer">
            <span class="product-price">₵${Number(prod.price).toFixed(2)}</span>
            <button class="add-to-cart-btn" title="Add to Cart" ${!prod.in_stock ? 'disabled' : ''}>
              <i class="fas fa-cart-plus"></i>
            </button>
          </div>
        </div>
      `;
      // Attach click handler safely — no inline JSON
      if (prod.in_stock) {
        card.querySelector('.add-to-cart-btn').addEventListener('click', () => addToCart(prod));
      }
      productsGrid.appendChild(card);
    });
  }
}

loadProducts();

// =====================
// MOBILE MENU
// =====================
function toggleMobileMenu() {
  const nav = document.getElementById("navLinks");
  const btn = document.getElementById("mobileMenuBtn");
  const isOpen = nav.classList.toggle("open");
  btn.classList.toggle("active", isOpen);
  // Prevent body scroll when menu open
  document.body.style.overflow = isOpen ? "hidden" : "";
}

// =====================
// CART SYSTEM
// =====================
let cart = [];
try {
  const stored = localStorage.getItem("anvicaCart");
  if (stored) {
    cart = JSON.parse(stored);
    // Remove the sanitization logic since we are no longer using the Base64 SVG
    localStorage.setItem("anvicaCart", JSON.stringify(cart));
  }
} catch (e) {
  cart = []; // Reset if corrupted JSON
}

function toggleCart() {
  const open = document.getElementById("cartSidebar").classList.contains("open");
  if (open) closeCart(); else openCart();
}

function openCart() {
  document.getElementById("cartOverlay").classList.add("open");
  document.getElementById("cartSidebar").classList.add("open");
  renderCart();
}

function closeCart() {
  document.getElementById("cartOverlay").classList.remove("open");
  document.getElementById("cartSidebar").classList.remove("open");
}

function addToCart(prod) {
  const existing = cart.find(item => item.id === prod.id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...prod, qty: 1 });
  }
  localStorage.setItem("anvicaCart", JSON.stringify(cart));
  showToast(`<i class="fas fa-check-circle"></i> ${prod.name} added to cart`);
  updateCartBadge();
  // Animate badge
  const badge = document.getElementById("cartBadge");
  badge.classList.remove("pulse");
  void badge.offsetWidth;
  badge.classList.add("pulse");
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  const count = cart.reduce((acc, item) => acc + item.qty, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

function renderCart() {
  const cartItemsEl = document.getElementById("cartItems");
  const cartFooter = document.getElementById("cartFooter");
  cartItemsEl.innerHTML = "";

  if (cart.length === 0) {
    cartItemsEl.innerHTML = `
      <div class="cart-empty">
        <i class="fas fa-shopping-basket"></i>
        <p>Your cart is empty</p>
        <small>Add some products to get started!</small>
      </div>`;
    cartFooter.style.display = "none";
    return;
  }

  cartFooter.style.display = "block";
  let total = 0;

  cart.forEach(item => {
    total += item.price * item.qty;
    const div = document.createElement("div");
    div.className = "cart-item";
    div.dataset.id = item.id;

    // Only render image tag if image URL is valid
    const hasValidImage = isValidImageUrl(item.image);
    const imgHtml = hasValidImage ? `<img src="${item.image.trim()}" alt="Product Image">` : '';

    div.innerHTML = `
      ${imgHtml}
      <div class="cart-item-info">
        <div class="name">${item.name}</div>
        <div class="price">₵${Number(item.price).toFixed(2)} each</div>
        <div class="cart-item-actions">
          <button class="qty-btn minus-btn" data-id="${item.id}"><i class="fas fa-minus"></i></button>
          <span class="cart-item-qty">${item.qty}</span>
          <button class="qty-btn plus-btn" data-id="${item.id}"><i class="fas fa-plus"></i></button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <span style="font-weight:700;color:var(--primary);font-size:1rem">₵${(item.price * item.qty).toFixed(2)}</span>
        <button class="cart-item-remove remove-btn" data-id="${item.id}" title="Remove">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;
    cartItemsEl.appendChild(div);
  });

  // Event delegation — one listener handles all buttons
  cartItemsEl.querySelectorAll(".minus-btn").forEach(btn =>
    btn.addEventListener("click", () => changeQty(btn.dataset.id, -1)));
  cartItemsEl.querySelectorAll(".plus-btn").forEach(btn =>
    btn.addEventListener("click", () => changeQty(btn.dataset.id, 1)));
  cartItemsEl.querySelectorAll(".remove-btn").forEach(btn =>
    btn.addEventListener("click", () => removeFromCart(btn.dataset.id)));

  document.getElementById("cartTotal").textContent = `₵${total.toFixed(2)}`;
  updateCartBadge();
}

function changeQty(id, delta) {
  const item = cart.find(i => String(i.id) === String(id));
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) return removeFromCart(id);
  localStorage.setItem("anvicaCart", JSON.stringify(cart));
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => String(i.id) !== String(id));
  localStorage.setItem("anvicaCart", JSON.stringify(cart));
  renderCart();
  updateCartBadge();
}

// =====================
// CHECKOUT
// =====================
function openCheckout() {
  if (cart.length === 0) return showToast("Cart is empty!", true);
  closeCart();
  renderOrderSummaryMini();
  document.getElementById("checkoutModal").classList.add("open");
}

function closeCheckout() {
  document.getElementById("checkoutModal").classList.remove("open");
}

function renderOrderSummaryMini() {
  const summary = document.getElementById("orderSummaryMini");
  let html = '';
  let total = 0;
  cart.forEach(item => {
    total += item.price * item.qty;
    html += `<div class="order-item-mini">
      <span>${item.name} × ${item.qty}</span>
      <span>₵${(item.price * item.qty).toFixed(2)}</span>
    </div>`;
  });
  html += `<div class="order-item-mini order-item-total">
    <span>Total</span><span>₵${total.toFixed(2)}</span>
  </div>`;
  summary.innerHTML = html;
}

// =====================
// ORDER PREVIEW
// =====================
function showOrderPreview(event) {
  event.preventDefault();
  const name = document.getElementById("customerName").value;
  const phone = document.getElementById("customerPhone").value;
  const address = document.getElementById("customerAddress").value;

  if (!name || !phone || !address) return showToast("Please fill all fields", true);

  document.getElementById("checkoutModal").classList.remove("open");
  document.getElementById("previewModal").classList.add("open");

  document.getElementById("previewCustomerDetails").innerHTML = `
    <div class="order-item-mini"><span><i class="fas fa-user"></i> Name</span><span>${name}</span></div>
    <div class="order-item-mini"><span><i class="fas fa-phone"></i> Phone</span><span>${phone}</span></div>
    <div class="order-item-mini"><span><i class="fas fa-map-marker-alt"></i> Address</span><span>${address}</span></div>`;

  const orderItems = document.getElementById("previewOrderItems");
  let html = '';
  let total = 0;
  cart.forEach(item => {
    total += item.price * item.qty;
    html += `<div class="order-item-mini">
      <span>${item.name} × ${item.qty}</span>
      <span>₵${(item.price * item.qty).toFixed(2)}</span>
    </div>`;
  });
  html += `<div class="order-item-mini order-item-total"><span>Total</span><span>₵${total.toFixed(2)}</span></div>`;
  orderItems.innerHTML = html;
}

function closePreview() {
  document.getElementById("previewModal").classList.remove("open");
  document.getElementById("checkoutModal").classList.add("open");
}

// =====================
// CONFIRM ORDER
// =====================
async function confirmOrder() {
  const btn = document.getElementById("confirmOrderBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';

  const name = document.getElementById("customerName").value;
  const phone = document.getElementById("customerPhone").value;
  const address = document.getElementById("customerAddress").value;
  const total = cart.reduce((acc, i) => acc + i.price * i.qty, 0);

  // Fetch the total number of orders to generate sequential order number
  let newOrderNumber = 'ANV-0001';
  const { count, error: countError } = await supabaseClient
    .from('orders')
    .select('*', { count: 'exact', head: true });

  if (!countError && count !== null) {
    newOrderNumber = `ANV-${String(count + 1).padStart(4, '0')}`;
  }

  const { error } = await supabaseClient.from('orders').insert([{
    customer_name: name, customer_phone: phone,
    customer_address: address, items: cart,
    total, order_number: newOrderNumber, status: 'pending'
  }]);

  if (!error) {
    try {
      await fetch('/api/notify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: newOrderNumber, customerName: name, customerPhone: phone, customerAddress: address, items: cart, total })
      });
    } catch (e) { console.log('Email skipped:', e.message); }

    document.getElementById("previewModal").classList.remove("open");
    document.getElementById("confirmationModal").classList.add("open");
    document.getElementById("orderNumber").textContent = newOrderNumber;
    cart = [];
    localStorage.setItem("anvicaCart", JSON.stringify(cart));
    updateCartBadge();
    document.getElementById("checkoutForm").reset();
  } else {
    showToast("Order failed: " + error.message, true);
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Confirm Order';
}

function closeConfirmation() {
  document.getElementById("confirmationModal").classList.remove("open");
}


// =====================
// TOAST
// =====================
function showToast(message, error = false) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${error ? 'error' : ''}`;
  toast.innerHTML = `<i class="fas fa-${error ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// =====================
// SMOOTH SCROLL
// =====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Close mobile menu if open
      document.getElementById("navLinks").classList.remove("open");
      document.getElementById("mobileMenuBtn").classList.remove("active");
      document.body.style.overflow = "";
    }
  });
});

// =====================
// NAVBAR SCROLL EFFECT
// =====================
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

updateCartBadge();