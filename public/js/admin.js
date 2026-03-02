// =====================
// FIREBASE SETUP
// =====================
const db = firebase.firestore();
const storage = firebase.storage();

// =====================
// AUTH & DASHBOARD
// =====================
let currentAdmin = null;

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    currentAdmin = user;
    document.getElementById("adminUsername").textContent = user.email || "Admin";
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    loadStats();
    loadProducts();
  } else {
    document.getElementById("authScreen").style.display = "flex";
    document.getElementById("dashboard").style.display = "none";
  }
});

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(err => showToast(err.message, true));
}

function handleLogout() {
  firebase.auth().signOut();
}

// =====================
// AUTH TABS
// =====================
function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
  document.querySelector(`.auth-tab[onclick="switchAuthTab('${tab}')"]`).classList.add("active");
  document.getElementById(`${tab}Form`).classList.add("active");
}

function handleSignup(event) {
  event.preventDefault();
  const email = document.getElementById("signupUsername").value;
  const password = document.getElementById("signupPassword").value;
  const confirm = document.getElementById("signupConfirm").value;

  if (password !== confirm) return showToast("Passwords do not match", true);

  firebase.auth().createUserWithEmailAndPassword(email, password)
    .catch(err => showToast(err.message, true));
}

// =====================
// STATS
// =====================
function loadStats() {
  db.collection("products").onSnapshot(snap => {
    document.getElementById("statProducts").textContent = snap.size;
    updateRevenue();
  });
  db.collection("orders").onSnapshot(snap => {
    document.getElementById("statOrders").textContent = snap.size;
    updateRevenue();
  });
}

function updateRevenue() {
  db.collection("orders").get().then(snapshot => {
    let total = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      total += data.total || 0;
    });
    document.getElementById("statRevenue").textContent = `₵${total.toFixed(2)}`;
  });
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
    document.getElementById("productDescription").value = prod.description;
    document.getElementById("productPrice").value = prod.price;
    document.getElementById("productCategory").value = prod.category;
    document.getElementById("productInStock").checked = prod.inStock;
    if (prod.image) {
      document.getElementById("previewImg").src = prod.image;
      document.getElementById("imagePreview").style.display = "block";
      document.getElementById("uploadPlaceholder").style.display = "none";
    }
  } else {
    document.getElementById("productModalTitle").innerHTML = '<i class="fas fa-plus-circle"></i> Add Product';
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
}

// =====================
// SAVE PRODUCT
// =====================
function saveProduct(event) {
  event.preventDefault();
  const id = document.getElementById("productId").value;
  const product = {
    name: document.getElementById("productName").value,
    description: document.getElementById("productDescription").value,
    price: parseFloat(document.getElementById("productPrice").value),
    category: document.getElementById("productCategory").value,
    inStock: document.getElementById("productInStock").checked
  };

  const uploadAndSave = (imageUrl) => {
    if (imageUrl) product.image = imageUrl;

    if (id) {
      db.collection("products").doc(id).update(product)
        .then(() => { closeProductModal(); showToast("Product updated!"); })
        .catch(err => showToast(err.message, true));
    } else {
      db.collection("products").add(product)
        .then(() => { closeProductModal(); showToast("Product added!"); })
        .catch(err => showToast(err.message, true));
    }
  };

  if (selectedFile) {
    const fileName = `${Date.now()}_${selectedFile.name}`;
    const storageRef = storage.ref().child(`products/${fileName}`);
    storageRef.put(selectedFile).then(snapshot => {
      snapshot.ref.getDownloadURL().then(url => uploadAndSave(url));
    }).catch(err => showToast("Image upload failed: " + err.message, true));
  } else {
    uploadAndSave(document.getElementById("previewImg").src || null);
  }
}

// =====================
// LOAD PRODUCTS
// =====================
function loadProducts() {
  db.collection("products").onSnapshot(snapshot => {
    const tbody = document.getElementById("productsTableBody");
    tbody.innerHTML = "";
    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-table"><i class="fas fa-box-open"></i><p>No products yet.</p></div></td></tr>`;
    } else {
      snapshot.forEach(doc => {
        const prod = doc.data();
        prod.id = doc.id;
        tbody.innerHTML += `
          <tr>
            <td><img src="${prod.image || '/images/placeholder.png'}" style="width:50px;height:50px;object-fit:cover;margin-right:8px">${prod.name}</td>
            <td>₵${prod.price.toFixed(2)}</td>
            <td>${prod.category}</td>
            <td>${prod.inStock ? 'In Stock' : 'Out of Stock'}</td>
            <td>
              <button onclick='openProductModal(${JSON.stringify(prod)})'><i class="fas fa-edit"></i></button>
              <button onclick='deleteProduct("${prod.id}")'><i class="fas fa-trash-alt"></i></button>
            </td>
          </tr>`;
      });
    }
  });
}

// =====================
// DELETE PRODUCT
// =====================
function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  db.collection("products").doc(id).delete()
    .then(() => showToast("Product deleted!"))
    .catch(err => showToast(err.message, true));
}

// =====================
// TOAST
// =====================
function showToast(message, error = false) {
  const container = document.getElementById("adminToastContainer");
  const toast = document.createElement("div");
  toast.className = `admin-toast ${error ? 'error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}