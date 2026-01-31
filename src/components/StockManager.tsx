
import React, { useState } from 'react';
import { Product } from '../types';
import { Search, Package, Plus, Edit2, Save, X, AlertTriangle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface Props {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
}

const StockManager: React.FC<Props> = ({ products, onUpdateProducts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // États pour le nouveau produit
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Général',
    price: 0,
    stock: 0
  });

  // États pour l'édition
  const [editValues, setEditValues] = useState<{ name: string, stock: number, price: number }>({ name: '', stock: 0, price: 0 });

  const handleAddProduct = () => {
    if (!newProduct.name || newProduct.price <= 0) {
      alert("Veuillez saisir un nom et un prix valide.");
      return;
    }

    const product: Product = {
      id: Math.random().toString(36).substr(2, 9),
      name: newProduct.name,
      category: newProduct.category,
      defaultPrice: newProduct.price,
      stock: newProduct.stock
    };

    onUpdateProducts([product, ...products]);
    setNewProduct({ name: '', category: 'Général', price: 0, stock: 0 });
    setIsAdding(false);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditValues({ name: p.name, stock: p.stock, price: p.defaultPrice });
  };

  const saveEdit = (id: string) => {
    const updated = products.map(p =>
      p.id === id ? { ...p, name: editValues.name, stock: editValues.stock, defaultPrice: editValues.price } : p
    );
    onUpdateProducts(updated);
    setEditingId(null);
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Header & Search */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Package className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Stock</h2>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Inventaire & Prix</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={`p-2.5 rounded-xl transition-all flex items-center gap-2 font-bold text-xs uppercase ${isAdding ? 'bg-gray-100 text-gray-500' : 'bg-blue-600 text-white shadow-lg shadow-blue-200'}`}
          >
            {isAdding ? <X size={18} /> : <Plus size={18} />}
            {isAdding ? 'Fermer' : 'Nouveau'}
          </button>
        </div>

        {/* Formulaire d'ajout */}
        {isAdding && (
          <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 animate-in slide-in-from-top duration-300">
            <h3 className="text-xs font-black text-blue-900 uppercase mb-4 tracking-widest">Ajouter un nouveau produit</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nom du produit (ex: Ciment CPJ 45)"
                className="w-full p-3 bg-white border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                value={newProduct.name}
                onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Catégorie"
                  className="w-full p-3 bg-white border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={newProduct.category}
                  onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Prix (F CFA)"
                  className="w-full p-3 bg-white border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-black"
                  value={newProduct.price || ''}
                  onChange={e => setNewProduct({ ...newProduct, price: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-grow">
                  <input
                    type="number"
                    placeholder="Stock Initial"
                    className="w-full p-3 bg-white border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={newProduct.stock || ''}
                    onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <button
                  onClick={handleAddProduct}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-md"
                >
                  Ajouter au catalogue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Liste des produits */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.length > 0 ? (
          filtered.map(product => {
            const isLowStock = product.stock < 10;
            const isEditing = editingId === product.id;

            return (
              <div key={product.id} className={`bg-white p-4 rounded-2xl border transition-all ${isEditing ? 'ring-2 ring-blue-500 shadow-lg' : 'border-gray-100 shadow-sm'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-grow mr-2">
                    {isEditing ? (
                      <input
                        type="text"
                        className="w-full p-2 border border-blue-200 rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 mb-1"
                        value={editValues.name}
                        onChange={e => setEditValues({ ...editValues, name: e.target.value })}
                      />
                    ) : (
                      <h3 className="font-bold text-gray-900 leading-tight uppercase">{product.name}</h3>
                    )}
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase">{product.category}</span>
                  </div>
                  {!isEditing && (
                    <button onClick={() => startEdit(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={18} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Stock Actuel</p>
                    {isEditing ? (
                      <input
                        type="number"
                        className="w-full p-2 border border-blue-200 rounded-lg font-black text-blue-900 focus:ring-2 focus:ring-blue-500"
                        value={editValues.stock}
                        onChange={e => setEditValues({ ...editValues, stock: parseInt(e.target.value) || 0 })}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                          {product.stock}
                        </span>
                        {isLowStock && <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Prix Unitaire</p>
                    {isEditing ? (
                      <input
                        type="number"
                        className="w-full p-2 border border-blue-200 rounded-lg font-black text-blue-900 focus:ring-2 focus:ring-blue-500"
                        value={editValues.price}
                        onChange={e => setEditValues({ ...editValues, price: parseInt(e.target.value) || 0 })}
                      />
                    ) : (
                      <p className="text-lg font-black text-blue-600">
                        {new Intl.NumberFormat('fr-FR').format(product.defaultPrice)} <span className="text-xs">F</span>
                      </p>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => saveEdit(product.id)}
                      className="flex-grow bg-blue-600 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                      <Save size={18} /> Enregistrer
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Voulez-vous vraiment supprimer ce produit du catalogue ?")) {
                          const updated = products.filter(p => p.id !== product.id);
                          onUpdateProducts(updated);
                          setEditingId(null);
                        }
                      }}
                      className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 bg-gray-100 text-gray-500 rounded-xl"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Aucun produit trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockManager;
