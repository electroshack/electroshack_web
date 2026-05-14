import React, { useState, useEffect, useCallback } from "react";
import { Search, Package } from "lucide-react";
import API from "../api";

const categories = [
  { value: "", label: "All Items" },
  { value: "cell-phone", label: "Cell Phones" },
  { value: "laptop", label: "Laptops" },
  { value: "pc", label: "PCs" },
  { value: "tablet", label: "Tablets" },
  { value: "smartwatch", label: "Smartwatches" },
  { value: "accessory", label: "Accessories" },
  { value: "part", label: "Parts" },
  { value: "other", label: "Other" },
];

const conditionLabels = {
  new: "New",
  refurbished: "Refurbished",
  used: "Used",
  "for-parts": "For Parts",
};

const conditionColors = {
  new: "bg-green-100 text-green-700",
  refurbished: "bg-primary-100 text-primary-700",
  used: "bg-accent-100 text-accent-700",
  "for-parts": "bg-gray-100 text-gray-600",
};

export default function Shop() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const fetchItems = useCallback(async (searchTerm) => {
    setLoading(true);
    try {
      const params = { _t: Date.now() };
      if (category) params.category = category;
      if (searchTerm || search) params.search = searchTerm || search;
      const { data } = await API.get("/inventory/storefront", { params });
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [category, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const refresh = () => fetchItems();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchItems]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchItems(search);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-dark-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Shop</h1>
          <p className="text-gray-400 max-w-xl mx-auto mb-8">
            Browse our available inventory. All items are inspected, tested, and ready to go.
          </p>
          <form onSubmit={handleSearch} className="max-w-md mx-auto flex">
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-l-lg border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button type="submit" className="px-4 py-2.5 bg-accent-400 text-dark-900 rounded-r-lg hover:bg-accent-300 transition-colors">
              <Search size={18} />
            </button>
          </form>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  category === c.value
                    ? "bg-primary-500 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-primary-300"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-500">No items available</h3>
              <p className="text-sm text-gray-400 mt-1">Check back soon for new inventory!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map((item) => (
                <div key={item._id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-primary-200 transition-all hover:-translate-y-1 duration-300">
                  <div className="relative h-48 bg-white flex items-center justify-center overflow-hidden">
                    {item.images && item.images[0] && /^(https?:|data:image\/)/i.test(String(item.images[0])) ? (
                      <img
                        src={String(item.images[0])}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-contain p-2"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <Package size={48} className="text-gray-200" />
                    )}
                    <span
                      className={`absolute left-2 top-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shadow-sm border border-white/60 ${
                        conditionColors[item.condition] || "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {conditionLabels[item.condition] || item.condition}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-dark-900 text-sm leading-tight pr-2">{item.name}</h3>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary-500">${Number(item.sellingPrice ?? 0).toFixed(2)}</span>
                      <span className="text-xs text-gray-400">#{item.itemNumber}</span>
                    </div>
                    {item.quantity > 1 && (
                      <p className="text-xs text-gray-400 mt-1">{item.quantity} available</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
