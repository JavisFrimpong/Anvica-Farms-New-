// ===========================
// ANVICA FARMS - Main App
// ===========================

// --- State ---
let cart = JSON.parse(localStorage.getItem('anvica_cart') || '[]');
let products = [];

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    updateCartUI();
    initNavbar();
    initSmoothScroll();
});

// ===========================
// PRODUCTS
// ===========================

async function loadProducts() {
    const grid = document.getElementById('productsGrid');
    try {
        const res = await fetch('/api/products');
        products = await res.json();
        renderProducts();
    } catch (err) {
        grid.innerHTML = `
      <div class="no-products">
        <i class="fas fa-exclamation-circle"></i>
        <p>Unable to load products. Please try again later.</p>
      </div>`;
    }
}

function renderProducts() {
    const grid = document.getElementById('productsGrid');

    if (!products.length) {
        grid.innerHTML = `
      <div class="no-products">
        <i class="fas fa-box-open"></i>
        <p>No products available yet. Check back soon!</p>
      </div>`;
        return;
    }

    grid.innerHTML = products.map(p => {
        const inStock = p.in_stock === 1;
        const imgSrc = p.image || '';
        const imgHtml = imgSrc
            ? `<img src="${imgSrc}" alt="${p.name}" loading="lazy">`
            : `<div class="product-image-placeholder"><i class="fas fa-drumstick-bite"></i></div>`;

        return `
      <div class="product-card" data-id="${p.id}">
        ${!inStock ? '<div class="out-of-stock"><span>Out of Stock</span></div>' : ''}
        <div class="product-image">${imgHtml}
          <span class="category-tag">${p.category || 'General'}</span>
        </div>
        <div class="product-info">
          <h3 class="product-name">${p.name}</h3>
          <p class="product-desc">${p.description || ''}</p>
          <div class="product-footer">
            <div class="product-price">
              <span class="currency">₵</span>${parseFloat(p.price).toFixed(2)}
            </div>
            ${inStock ? `
              <button class="add-to-cart-btn" onclick="addToCart(${p.id})" title="Add to cart">
                <i class="fas fa-plus"></i>
              </button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
}

// ===========================
// CART
// ===========================

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.productId === productId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }

    saveCart();
    updateCartUI();
    showToast(`${product.name} added to cart!`, 'success');

    // Pulse badge animation
    const badge = document.getElementById('cartBadge');
    badge.classList.remove('pulse');
    void badge.offsetWidth;
    badge.classList.add('pulse');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    saveCart();
    updateCartUI();
    renderCartItems();
}

function updateQuantity(productId, delta) {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.productId !== productId);
    }

    saveCart();
    updateCartUI();
    renderCartItems();
}

function saveCart() {
    localStorage.setItem('anvica_cart', JSON.stringify(cart));
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getCartCount() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const count = getCartCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

function renderCartItems() {
    const container = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    const emptyEl = document.getElementById('cartEmpty');

    if (!cart.length) {
        container.innerHTML = `
      <div class="cart-empty">
        <i class="fas fa-shopping-basket"></i>
        <p>Your cart is empty</p>
      </div>`;
        footer.style.display = 'none';
        return;
    }

    footer.style.display = 'block';
    document.getElementById('cartTotal').textContent = `₵${getCartTotal().toFixed(2)}`;

    container.innerHTML = cart.map(item => {
        const imgSrc = item.image || '';
        const imgHtml = imgSrc
            ? `<img src="${imgSrc}" alt="${item.name}">`
            : `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 70'%3E%3Crect width='70' height='70' fill='%23f0f7e8'/%3E%3Ctext x='22' y='45' font-size='28'%3E🐔%3C/text%3E%3C/svg%3E" alt="${item.name}">`;
        return `
      <div class="cart-item">
        ${imgHtml}
        <div class="cart-item-info">
          <div class="name">${item.name}</div>
          <div class="price">₵${(item.price * item.quantity).toFixed(2)}</div>
          <div class="cart-item-actions">
            <button class="qty-btn" onclick="updateQuantity(${item.productId}, -1)">
              <i class="fas fa-minus"></i>
            </button>
            <span class="cart-item-qty">${item.quantity}</span>
            <button class="qty-btn" onclick="updateQuantity(${item.productId}, 1)">
              <i class="fas fa-plus"></i>
            </button>
            <button class="cart-item-remove" onclick="removeFromCart(${item.productId})">
              <i class="fas fa-trash"></i> Remove
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
}

// ===========================
// CART TOGGLE
// ===========================

function toggleCart() {
    const overlay = document.getElementById('cartOverlay');
    const sidebar = document.getElementById('cartSidebar');
    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
        overlay.classList.remove('open');
        sidebar.classList.remove('open');
        document.body.style.overflow = '';
    } else {
        renderCartItems();
        overlay.classList.add('open');
        sidebar.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

// ===========================
// CHECKOUT
// ===========================

function openCheckout() {
    if (!cart.length) return;

    // Close cart sidebar
    toggleCart();

    // Populate order summary
    const summaryEl = document.getElementById('orderSummaryMini');
    summaryEl.innerHTML = `
    <h4><i class="fas fa-receipt"></i> Order Summary</h4>
    ${cart.map(item => `
      <div class="summary-item">
        <span>${item.name} × ${item.quantity}</span>
        <span>₵${(item.price * item.quantity).toFixed(2)}</span>
      </div>`).join('')}
    <div class="summary-total">
      <span>Total</span>
      <span>₵${getCartTotal().toFixed(2)}</span>
    </div>`;

    // Open modal
    setTimeout(() => {
        document.getElementById('checkoutModal').classList.add('open');
        document.body.style.overflow = 'hidden';
    }, 300);
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('open');
    document.body.style.overflow = '';
}

// --- Order Preview (Step 1: Show preview) ---
function showOrderPreview(e) {
    e.preventDefault();

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('customerAddress').value.trim();

    // Close checkout modal
    closeCheckout();

    // Populate customer details preview
    document.getElementById('previewCustomerDetails').innerHTML = `
    <h4><i class="fas fa-user"></i> Your Details</h4>
    <div class="summary-item"><span><strong>Name:</strong></span><span>${name}</span></div>
    <div class="summary-item"><span><strong>Phone:</strong></span><span>${phone}</span></div>
    <div class="summary-item"><span><strong>Address:</strong></span><span>${address}</span></div>`;

    // Populate order items preview
    document.getElementById('previewOrderItems').innerHTML = `
    <h4><i class="fas fa-receipt"></i> Order Items</h4>
    ${cart.map(item => `
      <div class="summary-item">
        <span>${item.name} × ${item.quantity}</span>
        <span>₵${(item.price * item.quantity).toFixed(2)}</span>
      </div>`).join('')}
    <div class="summary-total">
      <span>Total (${getCartCount()} items)</span>
      <span>₵${getCartTotal().toFixed(2)}</span>
    </div>`;

    // Open preview modal
    setTimeout(() => {
        document.getElementById('previewModal').classList.add('open');
        document.body.style.overflow = 'hidden';
    }, 300);
}

function closePreview() {
    document.getElementById('previewModal').classList.remove('open');
    document.body.style.overflow = '';
}

// --- Confirm Order (Step 2: Actually submit) ---
async function confirmOrder() {
    const btn = document.getElementById('confirmOrderBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner" style="border-top-color:white;width:20px;height:20px;border-width:2px"></div> Processing...';
    btn.disabled = true;

    const orderData = {
        customerName: document.getElementById('customerName').value.trim(),
        customerPhone: document.getElementById('customerPhone').value.trim(),
        customerAddress: document.getElementById('customerAddress').value.trim(),
        items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity
        }))
    };

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to place order');

        // Clear cart
        cart = [];
        saveCart();
        updateCartUI();

        // Close preview modal
        closePreview();

        // Show confirmation
        document.getElementById('orderNumber').textContent = data.orderNumber;
        setTimeout(() => {
            document.getElementById('confirmationModal').classList.add('open');
            document.body.style.overflow = 'hidden';
        }, 300);

        // Reset form
        document.getElementById('checkoutForm').reset();

    } catch (err) {
        showToast(err.message || 'Failed to place order. Please try again.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function closeConfirmation() {
    document.getElementById('confirmationModal').classList.remove('open');
    document.body.style.overflow = '';
}

// ===========================
// TOAST NOTIFICATIONS
// ===========================

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===========================
// NAVBAR
// ===========================

function initNavbar() {
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Active link on scroll
    const sections = document.querySelectorAll('section[id], footer[id]');
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => link.classList.remove('active'));
                const activeLink = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
                if (activeLink) activeLink.classList.add('active');
            }
        });
    }, { threshold: 0.3, rootMargin: '-72px 0px 0px 0px' });

    sections.forEach(section => observer.observe(section));
}

function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('open');
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });

                // Close mobile menu
                document.getElementById('navLinks').classList.remove('open');
            }
        });
    });
}
