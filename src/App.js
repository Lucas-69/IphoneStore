import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, ShoppingCart, CheckCircle, XCircle, Upload, FileText } from 'lucide-react';
import { supabase } from './supabaseClient';

// Después de los imports
const mapSupplierFromDB = (dbSupplier) => ({
  id: dbSupplier.id,
  name: dbSupplier.name,
  contact: dbSupplier.contact,
  dollarRate: dbSupplier.dollar_rate,
  minPurchase: dbSupplier.min_purchase,
  location: dbSupplier.location
});

const mapProductFromDB = (dbProduct) => ({
  id: dbProduct.id,
  model: dbProduct.model,
  storage: dbProduct.storage,
  colors: dbProduct.colors,
  battery: dbProduct.battery,
  details: dbProduct.details,
  supplierId: dbProduct.supplier_id,
  priceTiers: dbProduct.price_tiers,
  minQuantity: dbProduct.min_quantity
});

const IPHONE_MODELS = [
  'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
  'iPhone 12', 'iPhone 12 Mini', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
  'iPhone 13', 'iPhone 13 Mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
  'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max'
];

const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB'];

const COLORS = {
  'Black': '#000000',
  'White': '#FFFFFF',
  'Red': '#FF0000',
  'Blue': '#0000FF',
  'Green': '#00FF00',
  'Purple': '#800080',
  'Pink': '#FFC0CB',
  'Gold': '#FFD700',
  'Silver': '#C0C0C0',
  'Graphite': '#3C3C3C',
  'Sierra Blue': '#69ABCE',
  'Alpine Green': '#506D5B',
  'Midnight': '#191970',
  'Starlight': '#FAF0E6',
  'Deep Purple': '#6A0DAD'
};

const BATTERY_OPTIONS = ['80%', '85%', '90%', '95%', '100%', 'Nueva'];

export default function IPhoneManager() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [markdownText, setMarkdownText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [transferFee, setTransferFee] = useState(false);

  // Formulario de proveedor
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact: '',
    dollarRate: '',
    minPurchase: '',
    location: ''
  });

  // Formulario de producto
  const [productForm, setProductForm] = useState({
    model: IPHONE_MODELS[0],
    storage: STORAGE_OPTIONS[1],
    color: Object.keys(COLORS)[0],
    battery: BATTERY_OPTIONS[4],
    details: '',
    supplierId: '',
    priceUSD: '',
    minQuantity: 1
  });

  // Cargar proveedores
  useEffect(() => {
    const loadSuppliers = async () => {
      const { data: suppliersData, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (suppliersData) {
        setSuppliers(suppliersData.map(mapSupplierFromDB));
      }
      if (error) console.error('Error cargando proveedores:', error);
    };
    loadSuppliers();
  }, []);

  // Cargar productos
  useEffect(() => {
    const loadProducts = async () => {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (productsData) {
        setProducts(productsData.map(mapProductFromDB));
      }
      if (error) console.error('Error cargando productos:', error);
    };
    loadProducts();
  }, []);

  // Parser de Markdown
  const parseMarkdown = (text) => {
    const lines = text.split('\n');
    const parsedSuppliers = [];
    const parsedProducts = [];

    let currentSupplier = null;
    let supplierId = Date.now();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detectar proveedor (línea con DOLAR $)
      const supplierMatch = line.match(/DOLAR\s*\$\s*([\d.,]+)\s*\|\s*([+\d\s-]+)\s*(.*)/i);
      if (supplierMatch) {
        supplierId = Date.now() + parsedSuppliers.length;
        const dollarRate = supplierMatch[1].replace(/[.,]/g, '');
        const contact = supplierMatch[2].trim();
        const name = supplierMatch[3].trim();

        currentSupplier = {
          id: supplierId,
          name: name || 'Proveedor',
          contact: contact,
          dollarRate: dollarRate,
          minPurchase: '',
          location: ''
        };
        parsedSuppliers.push(currentSupplier);
        continue;
      }

      // Detectar ubicación del proveedor
      if (currentSupplier && !currentSupplier.location) {
        const locationMatch = line.match(/(Lomas de Zamora|Buenos Aires|Argentina|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*(?:Provincia|Ciudad))/i);
        if (locationMatch) {
          currentSupplier.location = locationMatch[0];
        }
      }

      // Detectar compra mínima
      if (currentSupplier && !currentSupplier.minPurchase) {
        const minPurchaseMatch = line.match(/(\d+)\s*equipos?\s*primera\s*compra/i);
        if (minPurchaseMatch) {
          currentSupplier.minPurchase = `${minPurchaseMatch[1]} equipos`;
        }
      }

      // Detectar productos - NUEVO FORMATO MEJORADO
      if (currentSupplier && line.includes('USD')) {
        // Remover ** y otros caracteres de formato
        const cleanLine = line.replace(/\*\*/g, '').replace(/🔋/g, '').trim();

        // Patrón mejorado: captura "12 Pro 128GB graphito 86%" o "13 128GB azul 86%"
        // Formato: **MODELO STORAGE [COLOR] [BATERIA]** | [cantidad] x USD PRECIO
        const productMatch = cleanLine.match(/^([^|]+)\s*\|\s*(\d+)?\s*x?\s*USD\s*\$?\s*([\d.]+)/i);

        if (productMatch) {
          const modelPart = productMatch[1].trim();
          const priceUSD = productMatch[3];

          // Extraer información del modelo
          let model = 'iPhone';
          let storage = '128GB';
          let battery = '100%';
          let color = 'Black';
          let details = '';

          // Buscar número de modelo (11, 12, 13, 14, 15, 16)
          const modelNumMatch = modelPart.match(/(\d{2})\s*(Pro Max|Pro|Plus|Mini)?/i);
          if (modelNumMatch) {
            const num = modelNumMatch[1];
            const variant = modelNumMatch[2] ? ' ' + modelNumMatch[2] : '';
            model = `iPhone ${num}${variant}`;
          }

          // Buscar capacidad (64GB, 128GB, 256GB, etc.)
          const storageMatch = modelPart.match(/(\d+)\s*GB/i);
          if (storageMatch) {
            storage = storageMatch[1] + 'GB';
          }

          // Buscar batería (número seguido de %)
          const batteryMatch = modelPart.match(/(\d+)\s*%/);
          if (batteryMatch) {
            battery = `${batteryMatch[1]}%`;
          } else if (modelPart.match(/100%|nueva|nuevo/i)) {
            battery = '100%';
          }

          // Buscar color - debe estar entre la capacidad y la batería
          // Remover el modelo, storage y battery para quedarnos con el color
          let colorPart = modelPart
            .replace(/\d{2}\s*(Pro Max|Pro|Plus|Mini)?/i, '')
            .replace(/\d+\s*GB/i, '')
            .replace(/\d+\s*%/i, '')
            .replace(/100%/i, '')
            .replace(/nueva?/i, '')
            .replace(/\+\d+\/100%/g, '')
            .trim();

          // Si hay texto restante, es el color
          if (colorPart) {
            // Tomar la primera palabra como color
            const colorWords = colorPart.split(/\s+/);
            if (colorWords.length > 0) {
              color = mapColor(colorWords[0]);
            }
          }

          // Buscar detalles adicionales en paréntesis
          const detailsMatch = line.match(/\(([^)]+)\)/);
          if (detailsMatch) {
            details = detailsMatch[1];
          }

          // Detectar si hay información sobre "Batería nueva" en el texto
          if (line.match(/bater[ií]a\s+nueva/i)) {
            battery = 'Nueva';
            if (!details) details = 'Batería nueva';
          }

          parsedProducts.push({
            id: Date.now() + parsedProducts.length + Math.random(),
            model: model.trim(),
            storage: storage,
            color: color,
            battery: battery,
            details: details,
            supplierId: currentSupplier.id,
            priceUSD: priceUSD,
            minQuantity: 1
          });
        }
      }
    }

    return { suppliers: parsedSuppliers, products: parsedProducts };
  };

  // Mapear colores del markdown a los colores predefinidos
  const mapColor = (colorText) => {
    const colorMap = {
      'white': 'White',
      'black': 'Black',
      'graphite': 'Graphite',
      'graphito': 'Graphite',
      'green': 'Green',
      'blue': 'Blue',
      'azul': 'Blue',
      'celeste': 'Sierra Blue',
      'sierra blue': 'Sierra Blue',
      'red': 'Red',
      'pink': 'Pink',
      'purple': 'Purple',
      'violeta': 'Purple',
      'gold': 'Gold',
      'silver': 'Silver',
      'midnight': 'Midnight',
      'negro': 'Black',
      'mid': 'Midnight'
    };

    const normalized = colorText.toLowerCase().trim();
    return colorMap[normalized] || 'Black';
  };

  // Procesar importación
  const handleImport = () => {
    if (!markdownText.trim()) {
      alert('Por favor pega el contenido del Markdown');
      return;
    }

    const parsed = parseMarkdown(markdownText);
    setImportPreview(parsed);
  };

  // Confirmar importación
  const confirmImport = (replace = false) => {
    if (!importPreview) return;

    if (replace) {
      setSuppliers(importPreview.suppliers);
      setProducts(importPreview.products);
    } else {
      setSuppliers([...suppliers, ...importPreview.suppliers]);
      setProducts([...products, ...importPreview.products]);
    }

    setShowImportModal(false);
    setMarkdownText('');
    setImportPreview(null);
    alert(`Importado: ${importPreview.suppliers.length} proveedores y ${importPreview.products.length} productos`);
  };

  // Manejar proveedor
  const handleSaveSupplier = async () => {
    if (!supplierForm.name || !supplierForm.dollarRate) {
      alert('Por favor completa nombre y tipo de cambio');
      return;
    }

    const supplierData = {
      name: supplierForm.name,
      contact: supplierForm.contact,
      dollar_rate: parseFloat(supplierForm.dollarRate),
      min_purchase: supplierForm.minPurchase,
      location: supplierForm.location
    };

    if (editingSupplier) {
      // Actualizar
      const { data, error } = await supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', editingSupplier.id)
        .select();

      if (data) {
        setSuppliers(suppliers.map(s => s.id === editingSupplier.id ? mapSupplierFromDB(data[0]) : s));
      }
      if (error) console.error('Error:', error);
    } else {
      // Crear nuevo
      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplierData])
        .select();

      if (data) {
        setSuppliers([...suppliers, mapSupplierFromDB(data[0])]);
      }
      if (error) console.error('Error:', error);
    }

    resetSupplierForm();
  };

  const resetSupplierForm = () => {
    setSupplierForm({
      name: '',
      contact: '',
      dollarRate: '',
      minPurchase: '',
      location: ''
    });
    setEditingSupplier(null);
    setShowSupplierForm(false);
  };

  const handleEditSupplier = (supplier) => {
    setSupplierForm({
      name: supplier.name,
      contact: supplier.contact,
      dollarRate: supplier.dollarRate,
      minPurchase: supplier.minPurchase,
      location: supplier.location
    });
    setEditingSupplier(supplier);
    setShowSupplierForm(true);
  };

  const handleDeleteSupplier = async (id) => {
    if (window.confirm('¿Eliminar proveedor?')) {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (!error) {
        setSuppliers(suppliers.filter(s => s.id !== id));
        setProducts(products.filter(p => p.supplierId !== id));
      } else {
        console.error('Error:', error);
      }
    }
  };

  const handleSaveProduct = async () => {
    if (!productForm.supplierId || !productForm.priceUSD) {
      alert('Por favor completa proveedor y precio');
      return;
    }

    const productData = {
      model: productForm.model,
      storage: productForm.storage,
      colors: [productForm.color],
      battery: productForm.battery,
      details: productForm.details,
      supplier_id: productForm.supplierId,
      price_tiers: [{ quantity: 1, priceUSD: parseFloat(productForm.priceUSD) }],
      min_quantity: productForm.minQuantity
    };

    if (editingProduct) {
      // Actualizar
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id)
        .select();

      if (data) {
        setProducts(products.map(p => p.id === editingProduct.id ? mapProductFromDB(data[0]) : p));
      }
      if (error) console.error('Error:', error);
    } else {
      // Crear nuevo
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select();

      if (data) {
        setProducts([...products, mapProductFromDB(data[0])]);
      }
      if (error) console.error('Error:', error);
    }

    resetProductForm();
  };

  const resetProductForm = () => {
    setProductForm({
      model: IPHONE_MODELS[0],
      storage: STORAGE_OPTIONS[1],
      color: Object.keys(COLORS)[0],
      battery: BATTERY_OPTIONS[4],
      details: '',
      supplierId: '',
      priceUSD: '',
      minQuantity: 1
    });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const handleEditProduct = (product) => {
    setProductForm({
      ...product,
      color: product.colors ? product.colors[0] : Object.keys(COLORS)[0],
      supplierId: product.supplierId,
      priceUSD: product.priceTiers && product.priceTiers.length > 0 ? product.priceTiers[0].priceUSD : ''
    });
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('¿Eliminar producto?')) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (!error) {
        setProducts(products.filter(p => p.id !== id));
        setSelectedProducts(selectedProducts.filter(sp => sp.id !== id));
      } else {
        console.error('Error:', error);
      }
    }
  };

  // Manejar selección de productos
  const toggleProductSelection = (product) => {
    const isSelected = selectedProducts.find(p => p.id === product.id);
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
    } else {
      setSelectedProducts([...selectedProducts, { ...product, quantity: 1 }]);
    }
  };

  // Seleccionar todos los productos de un proveedor
  const toggleSupplierProducts = (supplierId) => {
    const supplierProducts = products.filter(p => p.supplierId === supplierId);
    const allSelected = supplierProducts.every(p =>
      selectedProducts.find(sp => sp.id === p.id)
    );

    if (allSelected) {
      // Deseleccionar todos
      setSelectedProducts(selectedProducts.filter(sp => sp.supplierId !== supplierId));
    } else {
      // Seleccionar todos
      const newProducts = supplierProducts
        .filter(p => !selectedProducts.find(sp => sp.id === p.id))
        .map(p => ({ ...p, quantity: 1 }));
      setSelectedProducts([...selectedProducts, ...newProducts]);
    }
  };

  // Verificar si todos los productos de un proveedor están seleccionados
  const areAllSupplierProductsSelected = (supplierId) => {
    const supplierProducts = products.filter(p => p.supplierId === supplierId);
    if (supplierProducts.length === 0) return false;
    return supplierProducts.every(p =>
      selectedProducts.find(sp => sp.id === p.id)
    );
  };

  const updateQuantity = (productId, quantity) => {
    setSelectedProducts(selectedProducts.map(p =>
      p.id === productId ? { ...p, quantity: Math.max(1, quantity) } : p
    ));
  };

  // Cálculos
  const calculatePriceARS = (priceUSD, supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? (priceUSD * parseFloat(supplier.dollarRate)).toFixed(2) : '0';
  };

  const calculateTotal = () => {
    const subtotal = selectedProducts.reduce((sum, p) => {
      const priceARS = parseFloat(calculatePriceARS(p.priceUSD, p.supplierId));
      return sum + (priceARS * p.quantity);
    }, 0);

    return transferFee ? subtotal * 1.06 : subtotal;
  };

  const groupBySupplier = () => {
    const groups = {};
    selectedProducts.forEach(p => {
      const supplier = suppliers.find(s => s.id === p.supplierId);
      if (!groups[p.supplierId]) {
        groups[p.supplierId] = {
          supplier,
          products: [],
          subtotal: 0
        };
      }
      const priceARS = parseFloat(calculatePriceARS(p.priceUSD, p.supplierId));
      groups[p.supplierId].products.push(p);
      groups[p.supplierId].subtotal += priceARS * p.quantity;
    });
    return groups;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          Sistema de Gestión de iPhones
        </h1>

        {/* Botón de Importar */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-6 py-3 rounded-lg flex items-center gap-2 transition text-lg font-semibold shadow-lg"
          >
            <Upload size={24} />
            Importar desde Markdown
          </button>
        </div>

        {/* Modal de Importación */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-800 rounded-xl p-6 max-w-4xl w-full my-4 border border-slate-600 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FileText />
                  Importar Markdown
                </h2>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setMarkdownText('');
                    setImportPreview(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {!importPreview ? (
                <>
                  <p className="text-gray-300 mb-4">
                    Pega aquí el contenido de tu archivo Markdown con la información de proveedores e iPhones:
                  </p>
                  <textarea
                    value={markdownText}
                    onChange={(e) => setMarkdownText(e.target.value)}
                    placeholder="Pega tu markdown aquí..."
                    className="w-full h-64 bg-slate-700 text-white p-4 rounded border border-slate-600 focus:outline-none focus:border-blue-400 font-mono text-sm resize-none touch-auto"
                  />
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleImport}
                      className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded transition"
                    >
                      Procesar
                    </button>
                    <button
                      onClick={() => {
                        setShowImportModal(false);
                        setMarkdownText('');
                      }}
                      className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
                    <h3 className="font-bold text-lg mb-2 text-green-400">✓ Datos detectados:</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Proveedores encontrados:</p>
                        <p className="text-xl font-bold">{importPreview.suppliers.length}</p>
                        <ul className="mt-2 space-y-1">
                          {importPreview.suppliers.map(s => (
                            <li key={s.id} className="text-gray-300">• {s.name} (${s.dollarRate})</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-gray-400">Productos encontrados:</p>
                        <p className="text-xl font-bold">{importPreview.products.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-700/50 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto touch-auto">
                    <h4 className="font-bold mb-2">Preview de productos:</h4>
                    <div className="space-y-1 text-sm">
                      {importPreview.products.slice(0, 10).map(p => (
                        <div key={p.id} className="flex items-center gap-2 text-gray-300">
                          <div
                            className="w-4 h-4 rounded-full border border-white"
                            style={{ backgroundColor: COLORS[p.color] }}
                          />
                          <span>{p.model} {p.storage} - USD ${p.priceUSD}</span>
                        </div>
                      ))}
                      {importPreview.products.length > 10 && (
                        <p className="text-gray-500 italic">... y {importPreview.products.length - 10} más</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 mb-4">
                    <p className="text-yellow-200 text-sm">
                      ⚠️ ¿Quieres agregar estos datos a los existentes o reemplazarlos?
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmImport(false)}
                      className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded transition flex-1"
                    >
                      Agregar a existentes
                    </button>
                    <button
                      onClick={() => confirmImport(true)}
                      className="bg-orange-600 hover:bg-orange-700 px-6 py-2 rounded transition flex-1"
                    >
                      Reemplazar todo
                    </button>
                    <button
                      onClick={() => setImportPreview(null)}
                      className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded transition"
                    >
                      Volver
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Sección de Proveedores */}
        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 mb-6 border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Proveedores</h2>
            <button
              onClick={() => setShowSupplierForm(!showSupplierForm)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Plus size={20} />
              Nuevo Proveedor
            </button>
          </div>

          {showSupplierForm && (
            <div className="bg-slate-700/50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Nombre del proveedor"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-blue-400"
                />
                                <input
                  type="text"
                  placeholder="Contacto (ej: +54 9 11...)"
                  value={supplierForm.contact}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-blue-400"
                />
                <input
                  type="number"
                  placeholder="Tipo de cambio (ej: 1455)"
                  value={supplierForm.dollarRate}
                  onChange={(e) => setSupplierForm({ ...supplierForm, dollarRate: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-blue-400"
                />
                <input
                  type="text"
                  placeholder="Compra mínima (ej: 3 equipos)"
                  value={supplierForm.minPurchase}
                  onChange={(e) => setSupplierForm({ ...supplierForm, minPurchase: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-blue-400"
                />
                <input
                  type="text"
                  placeholder="Ubicación"
                  value={supplierForm.location}
                  onChange={(e) => setSupplierForm({ ...supplierForm, location: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSaveSupplier}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition"
                >
                  {editingSupplier ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  onClick={resetSupplierForm}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(supplier => (
              <div key={supplier.id} className="bg-slate-700/70 p-4 rounded-lg border border-slate-600">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{supplier.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditSupplier(supplier)} className="text-blue-400 hover:text-blue-300">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteSupplier(supplier.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  {supplier.contact && <p>📱 {supplier.contact}</p>}
                  <p className="text-green-400 font-semibold">💵 ${supplier.dollarRate}</p>
                  {supplier.minPurchase && <p>📦 Min: {supplier.minPurchase}</p>}
                  {supplier.location && <p>📍 {supplier.location}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sección de Productos */}
        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 mb-6 border border-slate-700">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-2xl font-semibold">Productos</h2>
            <div className="flex gap-2">
              {selectedProducts.length > 0 && (
                <button
                  onClick={() => setShowComparison(!showComparison)}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
                >
                  {showComparison ? '✕ Cerrar' : '📊 Comparar'}
                </button>
              )}
              <button
                onClick={() => setShowProductForm(!showProductForm)}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Plus size={20} />
                Nuevo Producto
              </button>
            </div>
          </div>

          {showProductForm && (
            <div className="bg-slate-700/50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <select
                  value={productForm.model}
                  onChange={(e) => setProductForm({ ...productForm, model: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-purple-400"
                >
                  {IPHONE_MODELS.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>

                <select
                  value={productForm.storage}
                  onChange={(e) => setProductForm({ ...productForm, storage: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-purple-400"
                >
                  {STORAGE_OPTIONS.map(storage => (
                    <option key={storage} value={storage}>{storage}</option>
                  ))}
                </select>

                <select
                  value={productForm.color}
                  onChange={(e) => setProductForm({ ...productForm, color: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-purple-400"
                >
                  {Object.keys(COLORS).map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>

                <select
                  value={productForm.battery}
                  onChange={(e) => setProductForm({ ...productForm, battery: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-purple-400"
                >
                  {BATTERY_OPTIONS.map(battery => (
                    <option key={battery} value={battery}>{battery}</option>
                  ))}
                </select>

                <select
                  value={productForm.supplierId}
                  onChange={(e) => setProductForm({ ...productForm, supplierId: parseInt(e.target.value) })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-purple-400"
                >
                  <option value="">Seleccionar proveedor</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Precio USD"
                  value={productForm.priceUSD}
                  onChange={(e) => setProductForm({ ...productForm, priceUSD: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-purple-400"
                />

                <input
                  type="number"
                  placeholder="Cantidad mínima"
                  value={productForm.minQuantity}
                  onChange={(e) => setProductForm({ ...productForm, minQuantity: parseInt(e.target.value) })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-purple-400"
                />

                <textarea
                  placeholder="Detalles adicionales (pantalla cambiada, etc.)"
                  value={productForm.details}
                  onChange={(e) => setProductForm({ ...productForm, details: e.target.value })}
                  className="bg-slate-600 px-4 py-2 rounded border border-slate-500 focus:outline-none focus:border-purple-400 md:col-span-2"
                  rows="2"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSaveProduct}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition"
                >
                  {editingProduct ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  onClick={resetProductForm}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista de productos */}
          <div className="space-y-4">
            {suppliers.map(supplier => {
              const supplierProducts = products.filter(p => p.supplierId === supplier.id);
              if (supplierProducts.length === 0) return null;

              return (
                <div key={supplier.id} className="border border-slate-600 rounded-lg p-4 bg-slate-700/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg text-purple-300">{supplier.name}</h3>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={areAllSupplierProductsSelected(supplier.id)}
                        onChange={() => toggleSupplierProducts(supplier.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span>Seleccionar todos</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    {supplierProducts.map(product => {
                      const priceARS = calculatePriceARS(product.priceUSD, product.supplierId);
                      const isSelected = selectedProducts.find(p => p.id === product.id);

                      return (
                        <div
                          key={product.id}
                          className={`bg-slate-700/70 p-4 rounded-lg border transition ${isSelected ? 'border-green-400' : 'border-slate-600'
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={!!isSelected}
                              onChange={() => toggleProductSelection(product)}
                              className="w-5 h-5 cursor-pointer"
                            />

                            <div
                              className="w-6 h-6 rounded-full border-2 border-white flex-shrink-0"
                              style={{ backgroundColor: COLORS[product.color] }}
                              title={product.color}
                            />

                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold">{product.model}</span>
                                <span className="text-blue-300">{product.storage}</span>
                                <span className="text-yellow-300">🔋 {product.battery}</span>
                                {product.details && (
                                  <span className="text-xs text-gray-400">({product.details})</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-400 mt-1">
                                Min: {product.minQuantity} unidad{product.minQuantity > 1 ? 'es' : ''}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-semibold text-green-400">
                                USD ${product.priceUSD}
                              </div>
                              <div className="text-sm text-gray-300">
                                ${priceARS} ARS
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button onClick={() => handleEditProduct(product)} className="text-blue-400 hover:text-blue-300">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDeleteProduct(product.id)} className="text-red-400 hover:text-red-300">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vista Comparativa */}
        {showComparison && selectedProducts.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 mb-6 border border-slate-700">
            <h2 className="text-2xl font-semibold mb-4">📊 Comparativa por Proveedor</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Object.entries(groupBySupplier()).map(([supplierId, group]) => (
                <div key={supplierId} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="mb-4 pb-3 border-b border-slate-500">
                    <h3 className="font-bold text-xl text-purple-300">{group.supplier?.name}</h3>
                    <div className="text-sm text-gray-400 mt-1">
                      💵 Dólar: ${group.supplier?.dollarRate}
                      {group.supplier?.minPurchase && ` • 📦 ${group.supplier.minPurchase}`}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {group.products.map(product => (
                      <div key={product.id} className="flex justify-between items-start text-sm bg-slate-600/30 p-2 rounded">
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className="w-4 h-4 rounded-full border border-white flex-shrink-0"
                            style={{ backgroundColor: COLORS[product.color] }}
                          />
                          <div>
                            <div className="font-medium">{product.model} {product.storage}</div>
                            <div className="text-xs text-gray-400">{product.color} • {product.battery}</div>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <input
                            type="number"
                            min="1"
                            value={product.quantity}
                            onChange={(e) => updateQuantity(product.id, parseInt(e.target.value))}
                            className="w-12 bg-slate-700 px-1 py-1 rounded text-center text-xs mb-1"
                          />
                          <div className="text-xs text-green-400 font-semibold">
                            ${(parseFloat(calculatePriceARS(product.priceUSD, product.supplierId)) * product.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-500 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span className="font-semibold">${group.subtotal.toFixed(2)}</span>
                    </div>
                    {transferFee && (
                      <div className="flex justify-between text-sm text-yellow-300">
                        <span>Transferencia (+6%):</span>
                        <span className="font-semibold">+${(group.subtotal * 0.06).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold text-green-400 border-t border-slate-500 pt-2">
                      <span>TOTAL:</span>
                      <span>${(transferFee ? group.subtotal * 1.06 : group.subtotal).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Comparación de ahorro */}
            {Object.keys(groupBySupplier()).length > 1 && (
              <div className="mt-4 bg-blue-900/30 border border-blue-600 rounded-lg p-4">
                <h4 className="font-bold mb-2 text-blue-300">💡 Análisis de ahorro</h4>
                {(() => {
                  const groups = Object.values(groupBySupplier());
                  const totals = groups.map(g => transferFee ? g.subtotal * 1.06 : g.subtotal);
                  const minTotal = Math.min(...totals);
                  const maxTotal = Math.max(...totals);
                  const savings = maxTotal - minTotal;
                  const cheapestSupplier = groups[totals.indexOf(minTotal)].supplier;
                  const expensiveSupplier = groups[totals.indexOf(maxTotal)].supplier;

                  return (
                    <div className="text-sm space-y-1">
                      <p>✅ <span className="text-green-400 font-semibold">{cheapestSupplier?.name}</span> es el más económico</p>
                      <p>💰 Te ahorras <span className="text-yellow-300 font-bold">${savings.toFixed(2)}</span> comprando con {cheapestSupplier?.name} en vez de {expensiveSupplier?.name}</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Carrito */}
        {selectedProducts.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart />
              Presupuesto
            </h2>

            {Object.entries(groupBySupplier()).map(([supplierId, group]) => (
              <div key={supplierId} className="mb-6 bg-slate-700/50 p-4 rounded-lg">
                <h3 className="font-bold text-lg mb-3 text-purple-300">{group.supplier?.name}</h3>
                {group.products.map(product => (
                  <div key={product.id} className="flex justify-between items-center mb-2 text-sm">
                    <div className="flex-1">
                      {product.model} {product.storage} • {product.color}
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={product.quantity}
                      onChange={(e) => updateQuantity(product.id, parseInt(e.target.value))}
                      className="w-16 bg-slate-600 px-2 py-1 rounded text-center mx-2"
                    />
                    <div className="w-32 text-right">
                      ${(parseFloat(calculatePriceARS(product.priceUSD, product.supplierId)) * product.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="border-t border-slate-600 mt-2 pt-2 text-right font-semibold">
                  Subtotal: ${group.subtotal.toFixed(2)}
                </div>
              </div>
            ))}

            <div className="border-t border-slate-600 pt-4">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transferFee}
                    onChange={(e) => setTransferFee(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span>Transferencia (+6%)</span>
                </label>
              </div>

              <div className="text-2xl font-bold text-right text-green-400">
                TOTAL: ${calculateTotal().toFixed(2)} ARS
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}