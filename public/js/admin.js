// =====================
// AUTH & DASHBOARD
// =====================
let currentAdmin = null;

// Supabase auth state listener
supabaseClient.auth.onAuthStateChange((event, session) => {
  const user = session?.user;
  if (user) {
    currentAdmin = user;
    document.getElementById("adminUsername").textContent = user.user_metadata?.display_name || user.email || "Admin";
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    loadStats();
    loadProducts();
    loadOrders();
  } else {
    currentAdmin = null;
    document.getElementById("authScreen").style.display = "flex";
    document.getElementById("dashboard").style.display = "none";
  }
});

async function handleLogin(event) {
  event.preventDefault();
  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

  const email = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    showToast(error.message, true);
    document.getElementById("authError").textContent = error.message;
    document.getElementById("authError").style.display = "block";
  } else {
    document.getElementById("authError").style.display = "none";
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  showToast("Logged out successfully");
}

// =====================
// AUTH TABS
// =====================
function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
  document.querySelector(`.auth-tab[onclick="switchAuthTab('${tab}')"]`).classList.add("active");
  document.getElementById(`${tab}Form`).classList.add("active");
  document.getElementById("authError").style.display = "none";
}

async function handleSignup(event) {
  event.preventDefault();
  const btn = document.getElementById("signupBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

  const displayName = document.getElementById("signupDisplayName").value;
  const email = document.getElementById("signupUsername").value;
  const password = document.getElementById("signupPassword").value;
  const confirm = document.getElementById("signupConfirm").value;

  if (password !== confirm) {
    showToast("Passwords do not match", true);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    return;
  }

  // Build redirect URL to admin dashboard
  const redirectUrl = window.location.origin + '/admin.html';

  const { error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: redirectUrl
    }
  });

  if (error) {
    showToast(error.message, true);
    document.getElementById("authError").textContent = error.message;
    document.getElementById("authError").style.display = "block";
  } else {
    showToast("Check your email for confirmation!");
    document.getElementById("authError").style.display = "none";
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
}

// =====================
// TAB SWITCHING
// =====================
function switchTab(tab) {
  // Update nav buttons
  document.querySelectorAll(".dashboard-nav button").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.dashboard-nav button[data-tab="${tab}"]`).classList.add("active");

  // Toggle panels
  document.getElementById("productsPanel").classList.toggle("active", tab === "products");
  document.getElementById("ordersPanel").classList.toggle("active", tab === "orders");

  // Refresh data when switching tabs
  if (tab === "orders") loadOrders();
  if (tab === "products") loadProducts();
}

// =====================
// STATS
// =====================
async function loadStats() {
  // Products count
  const { count: productCount, error: pError } = await supabaseClient
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (!pError) document.getElementById("statProducts").textContent = productCount || 0;

  // Orders count
  const { count: orderCount, error: oError } = await supabaseClient
    .from('orders')
    .select('*', { count: 'exact', head: true });

  if (!oError) document.getElementById("statOrders").textContent = orderCount || 0;

  updateRevenue();
}

async function updateRevenue() {
  const { data: orders, error } = await supabaseClient
    .from('orders')
    .select('total');

  if (!error && orders) {
    let total = 0;
    orders.forEach(order => {
      total += order.total || 0;
    });
    document.getElementById("statRevenue").textContent = `₵${total.toFixed(2)}`;
  }
}

// =====================
// PRODUCT MODAL & IMAGE
// =====================
let selectedFile = null;

function openProductModal(prod = null) {
  document.getElementById("productModal").style.display = "flex";
  document.getElementById("productForm").reset();
  selectedFile = null;
  document.getElementById("imagePreview").style.display = "none";
  document.getElementById("uploadPlaceholder").style.display = "flex";

  if (prod) {
    document.getElementById("productModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Product';
    document.getElementById("productId").value = prod.id;
    document.getElementById("productName").value = prod.name;
    document.getElementById("productDescription").value = prod.description || '';
    document.getElementById("productPrice").value = prod.price;
    document.getElementById("productCategory").value = prod.category || 'Live Birds';
    document.getElementById("productInStock").checked = prod.in_stock;
    if (prod.image) {
      document.getElementById("previewImg").src = prod.image;
      document.getElementById("imagePreview").style.display = "block";
      document.getElementById("uploadPlaceholder").style.display = "none";
    }
  } else {
    document.getElementById("productModalTitle").innerHTML = '<i class="fas fa-plus-circle"></i> Add Product';
    document.getElementById("productId").value = '';
  }
}

function closeProductModal() {
  document.getElementById("productModal").style.display = "none";
}

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedFile = file;

  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById("previewImg").src = e.target.result;
    document.getElementById("imagePreview").style.display = "block";
    document.getElementById("uploadPlaceholder").style.display = "none";
  };
  reader.readAsDataURL(file);
}

function removeSelectedImage() {
  selectedFile = null;
  document.getElementById("previewImg").src = "";
  document.getElementById("imagePreview").style.display = "none";
  document.getElementById("uploadPlaceholder").style.display = "flex";
  document.getElementById("imageFileInput").value = "";
  document.getElementById("cameraInput").value = "";
}

// =====================
// SAVE PRODUCT
// =====================
async function saveProduct(event) {
  event.preventDefault();
  const btn = document.getElementById("saveProductBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const id = document.getElementById("productId").value;
  const product = {
    name: document.getElementById("productName").value,
    description: document.getElementById("productDescription").value,
    price: parseFloat(document.getElementById("productPrice").value),
    category: document.getElementById("productCategory").value,
    in_stock: document.getElementById("productInStock").checked
  };

  const uploadAndSave = async (imageUrl) => {
    if (imageUrl) product.image = imageUrl;

    if (id) {
      product.updated_at = new Date().toISOString();
      const { error } = await supabaseClient.from('products').update(product).eq('id', id);
      if (!error) { closeProductModal(); showToast("Product updated!"); loadProducts(); loadStats(); }
      else showToast(error.message, true);
    } else {
      const { error } = await supabaseClient.from('products').insert([product]);
      if (!error) { closeProductModal(); showToast("Product added!"); loadProducts(); loadStats(); }
      else showToast(error.message, true);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Product';
  };

  if (selectedFile) {
    const fileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('product-images')
      .upload(fileName, selectedFile);

    if (uploadError) {
      showToast("Image upload failed: " + uploadError.message, true);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Save Product';
      return;
    }

    const { data: urlData } = supabaseClient.storage.from('product-images').getPublicUrl(fileName);
    await uploadAndSave(urlData.publicUrl);
  } else {
    const currentImg = document.getElementById("previewImg").src;
    await uploadAndSave(currentImg && !currentImg.startsWith('data:') && currentImg !== window.location.href ? currentImg : null);
  }
}

// =====================
// LOAD PRODUCTS
// =====================
async function loadProducts() {
  const { data: products, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  const tbody = document.getElementById("productsTableBody");
  tbody.innerHTML = "";

  if (error || !products || products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-table"><i class="fas fa-box-open"></i><p>No products yet. Click "Add Product" to get started.</p></div></td></tr>`;
  } else {
    products.forEach(prod => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${prod.image || '/images/placeholder.png'}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;margin-right:8px;vertical-align:middle">${prod.name}</td>
        <td>₵${Number(prod.price).toFixed(2)}</td>
        <td>${prod.category || 'General'}</td>
        <td><span class="status-badge ${prod.in_stock ? 'in-stock' : 'out-of-stock'}">${prod.in_stock ? 'In Stock' : 'Out of Stock'}</span></td>
        <td>
          <button class="action-btn edit" onclick='openProductModal(${JSON.stringify(prod).replace(/'/g, "&#39;")})'><i class="fas fa-edit"></i></button>
          <button class="action-btn delete" onclick='deleteProduct("${prod.id}")'><i class="fas fa-trash-alt"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// =====================
// DELETE PRODUCT
// =====================
async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  const { error } = await supabaseClient.from('products').delete().eq('id', id);
  if (!error) { showToast("Product deleted!"); loadProducts(); loadStats(); }
  else showToast(error.message, true);
}

// =====================
// LOAD ORDERS
// =====================
async function loadOrders() {
  const filterEl = document.getElementById("orderFilter");
  const filterStatus = filterEl ? filterEl.value : 'all';

  let query = supabaseClient.from('orders').select('*').order('created_at', { ascending: false });
  if (filterStatus !== 'all') {
    query = query.eq('status', filterStatus);
  }

  const { data: orders, error } = await query;

  const ordersList = document.getElementById("ordersList");
  ordersList.innerHTML = "";

  if (error || !orders || orders.length === 0) {
    ordersList.innerHTML = `<div class="empty-orders"><i class="fas fa-clipboard-list"></i><p>No orders yet.</p></div>`;
    return;
  }

  orders.forEach(order => {
    const card = document.createElement("div");
    card.className = "order-card";

    // Parse items
    let itemsHtml = '';
    const items = order.items || [];
    if (Array.isArray(items)) {
      itemsHtml = items.map(item =>
        `<div class="order-item-row">${item.name} x ${item.qty} — ₵${(item.price * item.qty).toFixed(2)}</div>`
      ).join('');
    }

    const statusClass = order.status === 'completed' ? 'completed' : (order.status === 'cancelled' ? 'cancelled' : 'pending');
    const createdAt = new Date(order.created_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    card.innerHTML = `
      <div class="order-card-header">
        <div>
          <span class="order-number">${order.order_number || 'N/A'}</span>
          <span class="order-date">${createdAt}</span>
        </div>
        <span class="order-status ${statusClass}">${order.status || 'pending'}</span>
      </div>
      <div class="order-card-body">
        <div class="order-customer">
          <p><i class="fas fa-user"></i> ${order.customer_name}</p>
          <p><i class="fas fa-phone"></i> ${order.customer_phone}</p>
          <p><i class="fas fa-map-marker-alt"></i> ${order.customer_address}</p>
        </div>
        <div class="order-items-list">${itemsHtml}</div>
        <div class="order-total">Total: ₵${Number(order.total).toFixed(2)}</div>
      </div>
      <div class="order-card-actions">
        <select onchange="updateOrderStatus('${order.id}', this.value)" class="status-select">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>
    `;
    ordersList.appendChild(card);
  });
}

// =====================
// UPDATE ORDER STATUS
// =====================
async function updateOrderStatus(id, status) {
  const { error } = await supabaseClient.from('orders').update({ status }).eq('id', id);
  if (!error) {
    showToast(`Order marked as ${status}`);
    loadStats();
  } else {
    showToast(error.message, true);
  }
}

// =====================
// TOAST
// =====================
function showToast(message, error = false) {
  const container = document.getElementById("adminToastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `admin-toast ${error ? 'error' : ''}`;
  toast.innerHTML = `<i class="fas fa-${error ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
