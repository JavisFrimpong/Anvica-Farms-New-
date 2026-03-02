// =====================
// FIREBASE SETUP
// =====================
const db = firebase.firestore();
const storage = firebase.storage();

// =====================
// PRODUCTS GRID
// =====================
const productsGrid = document.getElementById("productsGrid");

function loadProducts() {
  productsGrid.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;

  db.collection("products").onSnapshot(snapshot => {
    productsGrid.innerHTML = "";
    if (snapshot.empty) {
      productsGrid.innerHTML = `<p style="text-align:center; color:var(--text-light)">No products available.</p>`;
    } else {
      snapshot.forEach(doc => {
        const prod = doc.data();
        prod.id = doc.id;

        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
          <img src="${prod.image || '/images/placeholder.png'}" alt="${prod.name}">
          <h3>${prod.name}</h3>
          <p>${prod.description || ""}</p>
          <div class="product-footer">
            <span class="price">₵${prod.price.toFixed(2)}</span>
            <button class="add-to-cart-btn" ${!prod.inStock ? "disabled" : ""} onclick='addToCart(${JSON.stringify(prod)})'>
              <i class="fas fa-cart-plus"></i> ${prod.inStock ? "Add to Cart" : "Out of Stock"}
            </button>
          </div>
        `;
        productsGrid.appendChild(card);
      });
    }
  });
}

loadProducts();

// =====================
// MOBILE MENU
// =====================
function toggleMobileMenu() {
  document.getElementById("navLinks").classList.toggle("active");
}

// =====================
// CART SYSTEM
// =====================
let cart = JSON.parse(localStorage.getItem("anvicaCart")) || [];

function toggleCart() {
  document.getElementById("cartOverlay").classList.toggle("active");
  document.getElementById("cartSidebar").classList.toggle("active");
  renderCart();
}

function addToCart(prod) {
  const existing = cart.find(item => item.id === prod.id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...prod, qty: 1 });
  }
  localStorage.setItem("anvicaCart", JSON.stringify(cart));
  showToast(`${prod.name} added to cart`);
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  const count = cart.reduce((acc, item) => acc + item.qty, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

function renderCart() {
  const cartItems = document.getElementById("cartItems");
  const cartFooter = document.getElementById("cartFooter");
  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartItems.innerHTML = `<div class="cart-empty" id="cartEmpty"><i class="fas fa-shopping-basket"></i><p>Your cart is empty</p></div>`;
    cartFooter.style.display = "none";
    return;
  }

  cartFooter.style.display = "block";
  let total = 0;

  cart.forEach(item => {
    total += item.price * item.qty;
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="${item.image || '/images/placeholder.png'}" alt="${item.name}">
      <div class="item-info">
        <h4>${item.name}</h4>
        <span>₵${item.price.toFixed(2)} x ${item.qty}</span>
      </div>
      <div class="item-actions">
        <button onclick='changeQty("${item.id}", -1)'><i class="fas fa-minus"></i></button>
        <button onclick='changeQty("${item.id}", 1)'><i class="fas fa-plus"></i></button>
        <button onclick='removeFromCart("${item.id}")'><i class="fas fa-trash"></i></button>
      </div>
    `;
    cartItems.appendChild(div);
  });

  document.getElementById("cartTotal").textContent = `₵${total.toFixed(2)}`;
  updateCartBadge();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);
  localStorage.setItem("anvicaCart", JSON.stringify(cart));
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  localStorage.setItem("anvicaCart", JSON.stringify(cart));
  renderCart();
}

// =====================
// CHECKOUT
// =====================
function openCheckout() {
  if (cart.length === 0) return showToast("Cart is empty", true);
  document.getElementById("checkoutModal").style.display = "flex";
  renderOrderSummaryMini();
}

function closeCheckout() {
  document.getElementById("checkoutModal").style.display = "none";
}

function renderOrderSummaryMini() {
  const summary = document.getElementById("orderSummaryMini");
  summary.innerHTML = "";
  cart.forEach(item => {
    const div = document.createElement("div");
    div.className = "order-item-mini";
    div.textContent = `${item.name} x ${item.qty} - ₵${(item.price * item.qty).toFixed(2)}`;
    summary.appendChild(div);
  });
}

// =====================
// ORDER PREVIEW
// =====================
function showOrderPreview(event) {
  event.preventDefault();
  const name = document.getElementById("customerName").value;
  const phone = document.getElementById("customerPhone").value;
  const address = document.getElementById("customerAddress").value;

  if (!name || !phone || !address) return showToast("Fill all fields", true);

  document.getElementById("checkoutModal").style.display = "none";
  document.getElementById("previewModal").style.display = "flex";

  const details = document.getElementById("previewCustomerDetails");
  details.innerHTML = `<p><strong>Name:</strong> ${name}</p>
                       <p><strong>Phone:</strong> ${phone}</p>
                       <p><strong>Address:</strong> ${address}</p>`;

  const orderItems = document.getElementById("previewOrderItems");
  orderItems.innerHTML = "";
  cart.forEach(item => {
    const div = document.createElement("div");
    div.textContent = `${item.name} x ${item.qty} - ₵${(item.price * item.qty).toFixed(2)}`;
    orderItems.appendChild(div);
  });
}

function closePreview() {
  document.getElementById("previewModal").style.display = "none";
  document.getElementById("checkoutModal").style.display = "flex";
}

// =====================
// CONFIRM ORDER
// =====================
function confirmOrder() {
  const name = document.getElementById("customerName").value;
  const phone = document.getElementById("customerPhone").value;
  const address = document.getElementById("customerAddress").value;

  const total = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const orderNumber = `ANV-${Date.now()}`;

  db.collection("orders").add({
    customer: { name, phone, address },
    items: cart,
    total,
    orderNumber,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    document.getElementById("previewModal").style.display = "none";
    document.getElementById("confirmationModal").style.display = "flex";
    document.getElementById("orderNumber").textContent = orderNumber;
    cart = [];
    localStorage.setItem("anvicaCart", JSON.stringify(cart));
    renderCart();
  }).catch(err => showToast(err.message, true));
}

function closeConfirmation() {
  document.getElementById("confirmationModal").style.display = "none";
}

// =====================
// TOAST
// =====================
function showToast(message, error = false) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${error ? 'error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

updateCartBadge();