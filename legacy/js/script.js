/** @format */

const products = [
  {
    title: "Tokopedia",
    soldLabel: "Plus +",
    duration: "30 Hari",
    stock: 1,
    link: "page/tokopedia.html",
    sourceLabel: "Tokopedia",
  },
  {
    title: "Shopee",
    soldLabel: "VIP",
    duration: "90 Hari",
    stock: 0,
    link: "page/shopee.html",
    sourceLabel: "Shopee",
  },
];

const priceFormatter = new Intl.NumberFormat("id-ID");

function formatRupiah(value) {
  return `Rp ${priceFormatter.format(value)}`;
}

function renderProducts(items) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const stockAvailable = item.stock > 0;
    const buyHtml = stockAvailable
      ? `<a href="${item.link}" class="buy-btn">Click Me</a>`
      : `<button type="button" class="buy-btn" disabled aria-disabled="true">Maintenance</button>`;

    const priceHtml = item.newPrice
      ? `
          <div class="price-row">
            ${item.oldPrice ? `<span class="old-price">${formatRupiah(item.oldPrice)}</span>` : ""}
            <span class="new-price">${formatRupiah(item.newPrice)}</span>
          </div>`
      : "";

    card.innerHTML = `
      <div class="card-content">
        <div class="title-group">
          <h2 class="product-title">${item.title}</h2>
          <span class="sold-badge">${item.soldLabel}</span>
        </div>
        <div class="product-body">
          <div class="meta-col">
            <span class="meta-label">Durasi</span>
            <span class="meta-value">${item.duration}</span>
          </div>
        </div>
        ${priceHtml}
        ${buyHtml}
      </div>
    `;

    fragment.appendChild(card);
  });

  grid.replaceChildren(fragment);
}

renderProducts(products);
