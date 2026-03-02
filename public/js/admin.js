// ===========================
// ANVICA FARMS - Admin Dashboard
// ===========================

// --- State ---
let token = localStorage.getItem('anvica_admin_token');
let adminUser = localStorage.getItem('anvica_admin_user');
let adminProducts = [];
let adminOrders = [];
let editingProductId = null;
let selectedImageFile = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showDashboard();
    }
});

// ===========================
// AUTH
// ===========================

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    if (tab === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        document.getElementById('signupForm').classList.add('active');
    }

    hideAuthError();
}

function showAuthError(msg) {
    const el = document.getElementById('authError');
    el.textContent = msg;
    el.style.display = 'block';
}

function hideAuthError() {
    document.getElementById('authError').style.display = 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    hideAuthError();

    const btn = document.getElementById('loginBtn');
    btn.innerHTML = '<div class="admin-spinner"></div> Logging in...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('loginUsername').value.trim(),
                password: document.getElementById('loginPassword').value
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        token = data.token;
        adminUser = data.username;
        localStorage.setItem('anvica_admin_token', token);
        localStorage.setItem('anvica_admin_user', adminUser);
        showDashboard();
    } catch (err) {
        showAuthError(err.message);
    } finally {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        btn.disabled = false;
    }
}

async function handleSignup(e) {
    e.preventDefault();
    hideAuthError();

    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;

    if (password !== confirm) {
        showAuthError('Passwords do not match');
        return;
    }

    const btn = document.getElementById('signupBtn');
    btn.innerHTML = '<div class="admin-spinner"></div> Creating account...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/admin/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('signupUsername').value.trim(),
                password: password
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Signup failed');

        token = data.token;
        adminUser = data.username;
        localStorage.setItem('anvica_admin_token', token);
        localStorage.setItem('anvica_admin_user', adminUser);
        showDashboard();
        adminToast('Account created successfully!', 'success');
    } catch (err) {
        showAuthError(err.message);
    } finally {
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        btn.disabled = false;
    }
}

function handleLogout() {
    token = null;
    adminUser = null;
    localStorage.removeItem('anvica_admin_token');
    localStorage.removeItem('anvica_admin_user');
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('adminUsername').textContent = adminUser || 'Admin';
    loadAdminProducts();
    loadAdminOrders();
}

// ===========================
// TAB SWITCHING
// ===========================

function switchTab(tab) {
    document.querySelectorAll('.dashboard-nav button').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${tab}Panel`).classList.add('active');

    if (tab === 'orders') loadAdminOrders();
}

// ===========================
// PRODUCTS MANAGEMENT
// ===========================

async function loadAdminProducts() {
    try {
        const res = await fetch('/api/products');
        adminProducts = await res.json();
        renderAdminProducts();
        document.getElementById('statProducts').textContent = adminProducts.length;
    } catch (err) {
        adminToast('Failed to load products', 'error');
    }
}

function renderAdminProducts() {
    const tbody = document.getElementById('productsTableBody');

    if (!adminProducts.length) {
        tbody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-table">
          <i class="fas fa-box-open"></i>
          <p>No products yet. Click "Add Product" to get started.</p>
        </div>
      </td></tr>`;
        return;
    }

    tbody.innerHTML = adminProducts.map(p => {
        const imgSrc = p.image || '';
        const imgHtml = imgSrc
            ? `<img src="${imgSrc}" class="table-product-img" alt="${p.name}">`
            : `<div class="table-product-img" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem">🐔</div>`;

        return `
      <tr>
        <td>
          <div class="table-product-info">
            ${imgHtml}
            <div>
              <div class="table-product-name">${p.name}</div>
              <div class="table-product-cat">${p.category || 'General'}</div>
            </div>
          </div>
        </td>
        <td><span class="table-price">₵${parseFloat(p.price).toFixed(2)}</span></td>
        <td>${p.category || 'General'}</td>
        <td><span class="stock-badge ${p.in_stock ? 'in' : 'out'}">${p.in_stock ? 'In Stock' : 'Out of Stock'}</span></td>
        <td>
          <div class="table-actions">
            <button class="table-btn edit" onclick="editProduct(${p.id})" title="Edit">
              <i class="fas fa-pen"></i>
            </button>
            <button class="table-btn delete" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
}

// --- Product Modal ---

function openProductModal(product = null) {
    editingProductId = product ? product.id : null;
    selectedImageFile = null;

    document.getElementById('productModalTitle').innerHTML = product
        ? '<i class="fas fa-pen"></i> Edit Product'
        : '<i class="fas fa-plus-circle"></i> Add Product';

    document.getElementById('productId').value = product ? product.id : '';
    document.getElementById('productName').value = product ? product.name : '';
    document.getElementById('productDescription').value = product ? product.description || '' : '';
    document.getElementById('productPrice').value = product ? product.price : '';
    document.getElementById('productCategory').value = product ? product.category || 'Live Birds' : 'Live Birds';
    document.getElementById('productInStock').checked = product ? Boolean(product.in_stock) : true;

    // Image preview
    const preview = document.getElementById('imagePreview');
    const placeholder = document.getElementById('uploadPlaceholder');
    const area = document.getElementById('imageUploadArea');

    if (product && product.image) {
        document.getElementById('previewImg').src = product.image;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        area.classList.add('has-image');
    } else {
        preview.style.display = 'none';
        placeholder.style.display = 'block';
        area.classList.remove('has-image');
    }

    document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('open');
    document.getElementById('productForm').reset();
    editingProductId = null;
    selectedImageFile = null;
}

function editProduct(id) {
    const product = adminProducts.find(p => p.id === id);
    if (product) openProductModal(product);
}

async function deleteProduct(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
        const res = await fetch(`/api/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Delete failed');
        }

        adminToast(`"${name}" deleted successfully`, 'success');
        loadAdminProducts();
    } catch (err) {
        if (err.message === 'Invalid token') {
            handleLogout();
            return;
        }
        adminToast(err.message, 'error');
    }
}

async function saveProduct(e) {
    e.preventDefault();

    const btn = document.getElementById('saveProductBtn');
    btn.innerHTML = '<div class="admin-spinner"></div> Saving...';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('name', document.getElementById('productName').value.trim());
    formData.append('description', document.getElementById('productDescription').value.trim());
    formData.append('price', document.getElementById('productPrice').value);
    formData.append('category', document.getElementById('productCategory').value);
    formData.append('in_stock', document.getElementById('productInStock').checked ? '1' : '0');

    if (selectedImageFile) {
        formData.append('image', selectedImageFile);
    }

    const url = editingProductId ? `/api/products/${editingProductId}` : '/api/products';
    const method = editingProductId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');

        adminToast(
            editingProductId ? 'Product updated successfully!' : 'Product added successfully!',
            'success'
        );

        closeProductModal();
        loadAdminProducts();
    } catch (err) {
        if (err.message === 'Invalid token') {
            handleLogout();
            return;
        }
        adminToast(err.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-save"></i> Save Product';
        btn.disabled = false;
    }
}

// --- Image Handling ---

function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        adminToast('Image must be less than 5MB', 'error');
        return;
    }

    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById('previewImg').src = ev.target.result;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
        document.getElementById('imageUploadArea').classList.add('has-image');
    };
    reader.readAsDataURL(file);
}

function removeSelectedImage() {
    selectedImageFile = null;
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('uploadPlaceholder').style.display = 'block';
    document.getElementById('imageUploadArea').classList.remove('has-image');
    document.getElementById('imageFileInput').value = '';
    document.getElementById('cameraInput').value = '';
    document.getElementById('previewImg').src = '';
}

// ===========================
// ORDERS MANAGEMENT
// ===========================

async function loadAdminOrders() {
    try {
        const res = await fetch('/api/orders', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401) { handleLogout(); return; }
            throw new Error('Failed to load orders');
        }

        adminOrders = await res.json();
        renderAdminOrders();

        document.getElementById('statOrders').textContent = adminOrders.length;
        const totalRevenue = adminOrders.reduce((sum, o) => sum + o.total, 0);
        document.getElementById('statRevenue').textContent = `₵${totalRevenue.toFixed(2)}`;
    } catch (err) {
        adminToast('Failed to load orders', 'error');
    }
}

function renderAdminOrders() {
    const container = document.getElementById('ordersList');

    if (!adminOrders.length) {
        container.innerHTML = `
      <div class="empty-orders">
        <i class="fas fa-clipboard-list"></i>
        <p>No orders yet.</p>
      </div>`;
        return;
    }

    container.innerHTML = adminOrders.map(order => {
        const date = new Date(order.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const itemsHtml = (order.items || []).map(item => `
      <tr>
        <td>${item.product_name}</td>
        <td>${item.quantity}</td>
        <td>₵${parseFloat(item.price).toFixed(2)}</td>
        <td>₵${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`).join('');

        return `
      <div class="order-card">
        <div class="order-card-header" onclick="toggleOrderDetails(this)">
          <div>
            <div class="order-number">${order.order_number}</div>
            <div style="font-size:0.82rem;color:var(--admin-text-muted);margin-top:2px">${order.customer_name}</div>
          </div>
          <div class="order-meta">
            <span>${date}</span>
            <span class="order-total">₵${parseFloat(order.total).toFixed(2)}</span>
            <i class="fas fa-chevron-down" style="font-size:0.8rem"></i>
          </div>
        </div>
        <div class="order-details">
          <div class="order-customer">
            <div class="order-customer-field">
              <div class="label">Customer</div>
              <div class="value">${order.customer_name}</div>
            </div>
            <div class="order-customer-field">
              <div class="label">Phone</div>
              <div class="value">${order.customer_phone}</div>
            </div>
            <div class="order-customer-field">
              <div class="label">Address</div>
              <div class="value">${order.customer_address}</div>
            </div>
          </div>
          <table class="order-items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        </div>
      </div>`;
    }).join('');
}

function toggleOrderDetails(header) {
    const details = header.nextElementSibling;
    const icon = header.querySelector('.fa-chevron-down, .fa-chevron-up');
    details.classList.toggle('open');
    if (icon) {
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
    }
}

// ===========================
// TOAST
// ===========================

function adminToast(message, type = 'success') {
    const container = document.getElementById('adminToastContainer');
    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
