// My Items Management - loads from MongoDB via backend API

const MYITEMS_API_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api';

const CATEGORIES = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'books',       label: 'Books'       },
  { value: 'tools',       label: 'Tools'       },
  { value: 'sports',      label: 'Sports'      },
  { value: 'stationery',  label: 'Stationery'  },
  { value: 'vehicles',    label: 'Vehicles'    },
  { value: 'appliances',  label: 'Appliances'  },
  { value: 'furniture',   label: 'Furniture'   },
  { value: 'fashion',     label: 'Fashion'     },
  { value: 'properties',  label: 'Properties'  },
  { value: 'others',      label: 'Others'      }
];

function createSlideshow(images, altText) {
  const defaultImg = 'https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400';
  const imgs = (images && images.filter(Boolean).length > 0) ? images.filter(Boolean) : [defaultImg];
  let current = 0;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;height:200px;overflow:hidden;background:linear-gradient(135deg,#667eea,#764ba2)';

  const img = document.createElement('img');
  img.src = imgs[0];
  img.alt = altText || '';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;transition:opacity 0.3s';
  img.onerror = () => { img.src = defaultImg; };
  wrapper.appendChild(img);

  if (imgs.length > 1) {
    const counter = document.createElement('div');
    counter.style.cssText = 'position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);color:white;padding:2px 10px;border-radius:10px;font-size:0.75rem;z-index:5';
    counter.textContent = '1 / ' + imgs.length;
    wrapper.appendChild(counter);

    const btnStyle = 'position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;z-index:5';

    const prev = document.createElement('button');
    prev.innerHTML = '&#8249;';
    prev.setAttribute('style', btnStyle + ';left:8px');

    const next = document.createElement('button');
    next.innerHTML = '&#8250;';
    next.setAttribute('style', btnStyle + ';right:8px');

    const goTo = (index) => {
      current = (index + imgs.length) % imgs.length;
      img.style.opacity = '0';
      setTimeout(() => { img.src = imgs[current]; img.style.opacity = '1'; counter.textContent = (current + 1) + ' / ' + imgs.length; }, 150);
    };

    prev.addEventListener('click', (e) => { e.stopPropagation(); goTo(current - 1); });
    next.addEventListener('click', (e) => { e.stopPropagation(); goTo(current + 1); });
    wrapper.appendChild(prev);
    wrapper.appendChild(next);
  }

  return wrapper;
}

document.addEventListener('DOMContentLoaded', () => {
  const myItemsGrid = document.getElementById('myItemsGrid');
  if (!myItemsGrid) return;

  const username = localStorage.getItem('username');

  if (!username) {
    myItemsGrid.innerHTML = `
      <div style="text-align:center;padding:4rem 2rem;grid-column:1/-1">
        <h3>Please Login</h3>
        <a href="login.html" class="btn btn-primary">Go to Login</a>
      </div>`;
    return;
  }

  let allItems = [];
  injectEditModal();
  loadMyItems();

  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterAndRender(btn.dataset.filter || 'all');
    });
  });

  async function loadMyItems() {
    myItemsGrid.style.display = 'block';
    myItemsGrid.innerHTML = `<div style="text-align:center;padding:4rem"><i class="fas fa-spinner fa-spin" style="font-size:3rem;color:#007bff"></i><p>Loading your items...</p></div>`;

    try {
      const res  = await fetch(`${MYITEMS_API_URL}/items/my-items?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load items');
      allItems = data.items || [];
      filterAndRender(document.querySelector('.category-btn.active')?.dataset.filter || 'all');
    } catch (err) {
      myItemsGrid.innerHTML = `<div style="text-align:center;padding:2rem;color:red">Error: ${err.message}</div>`;
    }
  }

  function filterAndRender(filter) {
    let items = [...allItems];
    if (filter === 'active') items = items.filter(i => i.active && i.status === 'active');
    else if (filter === 'paused') items = items.filter(i => !i.active || i.status === 'paused');

    if (items.length === 0) {
      myItemsGrid.style.display = 'block';
      myItemsGrid.innerHTML = `
        <div style="text-align:center;padding:4rem 2rem;grid-column:1/-1">
          <i class="fas fa-inbox" style="font-size:4rem;color:#ccc;margin-bottom:1.5rem"></i>
          <h3>No Items Yet</h3>
          <p style="color:#666;margin-bottom:1.5rem">Start earning by listing your first item</p>
          <a href="lend.html" class="btn btn-primary"><i class="fas fa-plus"></i> List Your First Item</a>
        </div>`;
      return;
    }

    myItemsGrid.innerHTML = '';
    myItemsGrid.style.display = 'grid';
    myItemsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    myItemsGrid.style.gap = '1.5rem';
    items.forEach(item => myItemsGrid.appendChild(createItemCard(item)));
  }

  function createItemCard(item) {
    const itemId   = item.id || item._id;
    const isActive = item.active !== false && item.status !== 'paused';

    const card = document.createElement('div');
    card.className = 'item-card';
    card.style.cssText = 'background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);transition:all .3s;position:relative';

    const slideshow = createSlideshow(item.images && item.images.length > 0 ? item.images : [item.image], item.name);
    const statusBadge = document.createElement('div');
    statusBadge.style.cssText = `position:absolute;top:1rem;left:1rem;padding:.375rem .75rem;border-radius:50px;font-size:.8rem;font-weight:600;background:rgba(255,255,255,.95);color:${isActive ? '#10b981' : '#f59e0b'};z-index:5`;
    statusBadge.innerHTML = `<i class="fas fa-${isActive ? 'check-circle' : 'pause-circle'}"></i> ${isActive ? 'Active' : 'Paused'}`;
    slideshow.appendChild(statusBadge);

    // Edit pencil icon top-right of image
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-quick';
    editBtn.style.cssText = 'position:absolute;top:1rem;right:1rem;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.95);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#2563eb;font-size:.9rem;z-index:5;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:transform .15s';
    editBtn.innerHTML = '<i class="fas fa-pen"></i>';
    editBtn.title = 'Edit item';
    editBtn.addEventListener('mouseenter', () => editBtn.style.transform = 'scale(1.1)');
    editBtn.addEventListener('mouseleave', () => editBtn.style.transform = 'scale(1)');
    slideshow.appendChild(editBtn);

    card.appendChild(slideshow);

    const body = document.createElement('div');
    body.style.cssText = 'padding:1.5rem';
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:.5rem">
        <h3 style="margin:0;font-size:1.1rem;flex:1">${item.name}</h3>
        <span style="background:#f0f9ff;color:#007bff;padding:.25rem .75rem;border-radius:20px;font-size:.75rem;font-weight:600;margin-left:.5rem">${item.category}</span>
      </div>
      <p style="color:#666;font-size:.9rem;margin:.75rem 0;line-height:1.4">
        ${(item.description || '').substring(0, 60)}${(item.description || '').length > 60 ? '...' : ''}
      </p>
      <div style="display:flex;gap:.5rem;margin:.75rem 0;padding-bottom:.75rem;border-bottom:1px solid #eee">
        <span style="color:#10b981;font-weight:600">${item.price || 'Free'}</span>
        <span style="color:#ccc">|</span>
        <span style="color:#666;font-size:.9rem"><i class="fas fa-shield-alt" style="color:#f59e0b"></i> ₹${item.securityDeposit || 0} deposit</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;padding:.5rem 0;text-align:center;margin-bottom:1rem">
        <div>
          <i class="fas fa-star" style="color:#007bff"></i>
          <span style="display:block;font-weight:700">${(item.rating || 0).toFixed(1)}</span>
          <span style="font-size:.75rem;color:#999">Rating</span>
        </div>
        <div>
          <i class="fas fa-exchange-alt" style="color:#10b981"></i>
          <span style="display:block;font-weight:700">${item.borrowCount || 0}</span>
          <span style="font-size:.75rem;color:#999">Borrows</span>
        </div>
        <div>
          <i class="fas fa-tag" style="color:#f59e0b"></i>
          <span style="display:block;font-weight:700;text-transform:capitalize">${item.condition || 'good'}</span>
          <span style="font-size:.75rem;color:#999">Condition</span>
        </div>
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn-edit" style="flex:1;padding:.625rem;border-radius:8px;border:none;font-weight:600;cursor:pointer;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe">
          <i class="fas fa-pen"></i> Edit
        </button>
        <button class="btn-toggle" style="flex:1;padding:.625rem;border-radius:8px;border:none;font-weight:600;cursor:pointer;background:${isActive ? '#10b981' : '#e5e7eb'};color:${isActive ? 'white' : '#374151'}">
          <i class="fas fa-${isActive ? 'pause' : 'play'}"></i> ${isActive ? 'Pause' : 'Resume'}
        </button>
        <button class="btn-delete" style="flex:1;padding:.625rem;border-radius:8px;border:none;background:#ef4444;color:white;font-weight:600;cursor:pointer">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>`;

    card.appendChild(body);
    card.querySelector('.btn-toggle').addEventListener('click', () => toggleItem(itemId, item));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteItem(itemId));
    card.querySelector('.btn-edit').addEventListener('click', () => openEditModal(item));
    editBtn.addEventListener('click', () => openEditModal(item));
    return card;
  }

  async function toggleItem(itemId, item) {
    try {
      const newActive = !(item.active !== false);
      const res = await fetch(`${MYITEMS_API_URL}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          active: newActive,
          status: newActive ? 'active' : 'paused'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      await loadMyItems();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      const res = await fetch(`${MYITEMS_API_URL}/items/${itemId}?username=${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      await loadMyItems();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  EDIT MODAL
  // ═══════════════════════════════════════════════════════════════

  function injectEditModal() {
    if (document.getElementById('editItemModal')) return;

    const categoryOptions = CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'editItemModal';
    modal.style.cssText = `
      display:none;position:fixed;inset:0;z-index:99999;
      background:rgba(15,23,42,.7);backdrop-filter:blur(4px);
      align-items:center;justify-content:center;padding:1rem;
    `;
    modal.innerHTML = `
      <div style="background:white;border-radius:20px;width:100%;max-width:560px;max-height:90vh;
                  display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.35);overflow:hidden">

        <!-- Header -->
        <div style="padding:1.25rem 1.75rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div style="font-size:1.15rem;font-weight:700;color:#1f2937"><i class="fas fa-pen" style="color:#2563eb"></i> Edit Item</div>
          <button id="closeEditModal" style="background:none;border:none;color:#9ca3af;font-size:1.2rem;cursor:pointer;padding:.25rem">✕</button>
        </div>

        <!-- Body (scrollable) -->
        <div style="padding:1.5rem 1.75rem;overflow-y:auto;flex:1">
          <input type="hidden" id="editItemId">

          <div style="margin-bottom:1.1rem">
            <label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem">Item Name *</label>
            <input type="text" id="editItemName" style="width:100%;padding:.65rem .85rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;outline:none" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.1rem">
            <div>
              <label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem">Category *</label>
              <select id="editCategory" style="width:100%;padding:.65rem .85rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;outline:none;background:white">
                ${categoryOptions}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem">Condition</label>
              <select id="editCondition" style="width:100%;padding:.65rem .85rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;outline:none;background:white">
                <option value="new">New</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom:1.1rem">
            <label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem">Description</label>
            <textarea id="editDescription" rows="3" style="width:100%;padding:.65rem .85rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;outline:none;resize:vertical;font-family:inherit"></textarea>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.1rem">
            <div>
              <label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem">Price per Day (₹)</label>
              <input type="number" id="editPrice" min="0" step="0.01" style="width:100%;padding:.65rem .85rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;outline:none" />
            </div>
            <div>
              <label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem">Security Deposit (₹)</label>
              <input type="number" id="editDeposit" min="0" step="0.01" style="width:100%;padding:.65rem .85rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;outline:none" />
            </div>
          </div>

          <div style="margin-bottom:1.1rem">
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
              <input type="checkbox" id="editIsFree" style="width:16px;height:16px;accent-color:#2563eb" />
              <span style="font-size:.85rem;color:#374151;font-weight:600">This item is free to borrow</span>
            </label>
          </div>

          <div style="margin-bottom:1.1rem">
            <label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem">Phone Number</label>
            <input type="tel" id="editPhone" style="width:100%;padding:.65rem .85rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;outline:none" />
          </div>

          <div style="margin-bottom:1.1rem">
            <label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem">Location</label>
            <input type="text" id="editLocation" style="width:100%;padding:.65rem .85rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;outline:none" />
          </div>

          <div style="margin-bottom:.5rem">
            <label style="display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem">Pickup Instructions</label>
            <textarea id="editPickupInstructions" rows="2" style="width:100%;padding:.65rem .85rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;outline:none;resize:vertical;font-family:inherit"></textarea>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:1.1rem 1.75rem;border-top:1px solid #e5e7eb;display:flex;gap:.75rem;flex-shrink:0">
          <button id="cancelEditBtn" style="flex:1;padding:.75rem;background:#f3f4f6;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:.9rem;color:#374151">Cancel</button>
          <button id="saveEditBtn" style="flex:2;padding:.75rem;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem">
            <i class="fas fa-save"></i> Save Changes
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeEditModal(); });

    document.getElementById('editIsFree').addEventListener('change', e => {
      document.getElementById('editPrice').disabled = e.target.checked;
      document.getElementById('editPrice').style.opacity = e.target.checked ? '.5' : '1';
    });

    document.getElementById('saveEditBtn').addEventListener('click', saveEditedItem);
  }

  function openEditModal(item) {
    const itemId = item.id || item._id;

    document.getElementById('editItemId').value          = itemId;
    document.getElementById('editItemName').value         = item.name || '';
    document.getElementById('editCategory').value         = item.category || 'others';
    document.getElementById('editCondition').value        = item.condition || 'good';
    document.getElementById('editDescription').value      = item.description || '';

    // Price comes as "₹50" or "Free" string from backend — extract number
    const priceNum = parseFloat(String(item.price || '0').replace(/[^\d.]/g, '')) || 0;
    const isFree   = !item.price || item.price === 'Free' || priceNum === 0;

    document.getElementById('editPrice').value    = priceNum || item.pricePerDay || 0;
    document.getElementById('editDeposit').value  = item.securityDeposit || 0;
    document.getElementById('editIsFree').checked = isFree;
    document.getElementById('editPrice').disabled = isFree;
    document.getElementById('editPrice').style.opacity = isFree ? '.5' : '1';

    document.getElementById('editPhone').value             = item.phoneNumber || item.phone || '';
    document.getElementById('editLocation').value           = item.locationPrimary || item.location || '';
    document.getElementById('editPickupInstructions').value = item.pickupInstructions || '';

    document.getElementById('editItemModal').style.display = 'flex';
  }

  function closeEditModal() {
    document.getElementById('editItemModal').style.display = 'none';
  }

  async function saveEditedItem() {
    const itemId = document.getElementById('editItemId').value;
    const isFree = document.getElementById('editIsFree').checked;

    const name        = document.getElementById('editItemName').value.trim();
    const category    = document.getElementById('editCategory').value;
    const condition    = document.getElementById('editCondition').value;
    const description = document.getElementById('editDescription').value.trim();
    const pricePerDay = isFree ? 0 : parseFloat(document.getElementById('editPrice').value || 0);
    const deposit      = parseFloat(document.getElementById('editDeposit').value || 0);
    const phoneNumber  = document.getElementById('editPhone').value.trim();
    const location     = document.getElementById('editLocation').value.trim();
    const pickupInstructions = document.getElementById('editPickupInstructions').value.trim();

    if (!name) { alert('Item name is required.'); return; }

    const saveBtn = document.getElementById('saveEditBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      const res = await fetch(`${MYITEMS_API_URL}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          name,
          category,
          condition,
          description,
          price: isFree ? 'Free' : `₹${pricePerDay}`,
          pricePerDay,
          securityDeposit: deposit,
          phoneNumber,
          location,
          locationPrimary: location,
          pickupInstructions
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update item');

      closeEditModal();
      await loadMyItems();

      // Toast
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:.875rem 1.5rem;border-radius:12px;font-weight:700;font-size:.875rem;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,.2)';
      toast.innerHTML = '<i class="fas fa-check-circle"></i> Item updated successfully!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
  }
});