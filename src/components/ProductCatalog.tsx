
import React, { useState } from 'react';
import { Product } from '../types';
import { Search, Plus, X, AlertTriangle } from 'lucide-react';

interface Props {
  products: Product[];
  onSelect: (product: Product) => void;
  onClose: () => void;
}

const ProductCatalog: React.FC<Props> = ({ products, onSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg h-[80vh] sm:h-auto sm:max-h-[600px] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="p-4 border-b flex justify-between items-center bg-blue-50">
          <h2 className="font-bold text-blue-900 flex items-center gap-2">
            <Plus className="text-blue-600" size={20} />
            Stock & Catalogue
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4 bg-white sticky top-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              autoFocus
              type="text"
              placeholder="Rechercher (Ciment, Fer, etc...)"
              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-2">
          {filteredProducts.length > 0 ? (
            filteredProducts.map(product => {
              const isLow = product.stock <= 0;
              return (
                <button
                  key={product.id}
                  disabled={isLow}
                  onClick={() => {
                    onSelect(product);
                    onClose();
                  }}
                  className={`w-full flex justify-between items-center p-4 rounded-xl border transition-all text-left group ${isLow ? 'bg-gray-50 opacity-60 cursor-not-allowed border-gray-100' : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                >
                  <div>
                    <p className={`font-bold ${isLow ? 'text-gray-400' : 'text-gray-800 group-hover:text-blue-900'}`}>{product.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-gray-500 uppercase font-medium">{product.category}</p>
                      <span className={`text-[10px] font-black px-1.5 rounded-md ${product.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {product.stock} en stock
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black ${isLow ? 'text-gray-400' : 'text-blue-700'}`}>
                      {new Intl.NumberFormat('fr-FR').format(product.defaultPrice)} F
                    </p>
                    {isLow ? (
                      <span className="text-[8px] text-red-500 font-bold flex items-center gap-1"><AlertTriangle size={8} /> RUPTURE</span>
                    ) : (
                      <p className="text-[10px] text-gray-400">Ajouter +</p>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 italic">Aucun produit trouvé</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCatalog;
