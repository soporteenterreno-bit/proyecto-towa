import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Settings, Tags, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight, Layers, Store, Building, AlertTriangle } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { usePageTitle } from '../hooks/usePageTitle';

interface Question {
  id: string;
  text: string;
  points: number;
}

interface Componente {
  id: string;
  categoria_id: string;
  name: string;
  questions: Question[];
}

interface Categoria {
  id: string;
  nombre: string;
  tipo?: string;
}

export default function Configuracion() {
  usePageTitle('Configuración');
  const { showAlert, showConfirm } = useNotification();
  const [activeTab, setActiveTab] = useState<'Tienda' | 'Oficina'>('Tienda');
  
  // Categorias state
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [editingCategoria, setEditingCategoria] = useState<string | null>(null);
  const [categoriaForm, setCategoriaForm] = useState({ id: '', nombre: '' });
  
  // Componentes state
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  
  // Component Editor state
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compForm, setCompForm] = useState({ id: '', categoria_id: '', name: '', questions: [] as Question[] });

  const fetchData = async () => {
    setLoadingCategorias(true);
    const [catRes, compRes] = await Promise.all([
      supabase.from('categorias_inventario').select('*').order('nombre'),
      supabase.from('preguntas_componentes').select('*')
    ]);
    if (catRes.data) setCategorias(catRes.data);
    if (compRes.data) setComponentes(compRes.data as Componente[]);
    setLoadingCategorias(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleCatExpansion = (catId: string) => {
    setExpandedCats(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);
  };

  // --- Handlers para Categorías ---
  const handleSaveCategoria = async () => {
    if (!categoriaForm.nombre.trim()) return showAlert("El nombre es requerido", "warning");
    try {
      if (categoriaForm.id) {
        // En update no modificamos el tipo, solo nombre
        await supabase.from('categorias_inventario').update({ nombre: categoriaForm.nombre }).eq('id', categoriaForm.id);
      } else {
        await supabase.from('categorias_inventario').insert([{ nombre: categoriaForm.nombre, tipo: activeTab }]);
      }
      setEditingCategoria(null);
      fetchData();
    } catch (e: any) {
      showAlert("Error: " + e.message, "error");
    }
  };

  const handleDeleteCategoria = async (id: string) => {
    if(!(await showConfirm("¿Seguro que deseas eliminar esta categoría? Se eliminarán también sus componentes."))) return;
    await supabase.from('categorias_inventario').delete().eq('id', id);
    fetchData();
  };

  // --- Handlers para Componentes ---
  const handleCreateComponente = (catId: string) => {
    setEditingCompId(`new_${Date.now()}`);
    setCompForm({ id: '', categoria_id: catId, name: '', questions: [] });
  };

  const handleEditComponente = (comp: Componente) => {
    setEditingCompId(comp.id);
    setCompForm({ id: comp.id, categoria_id: comp.categoria_id, name: comp.name, questions: comp.questions || [] });
  };

  const addQuestionToComp = () => {
    setCompForm(prev => ({
      ...prev,
      questions: [...prev.questions, { id: `q_${Date.now()}`, text: '', points: 0 }]
    }));
  };

  const updateQuestion = (id: string, field: 'text'|'points', value: any) => {
    setCompForm(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, [field]: value } : q)
    }));
  };

  const removeQuestion = async (id: string) => {
    if (await showConfirm("¿Estás seguro de eliminar este ítem/pregunta del componente?")) {
      setCompForm(prev => ({
        ...prev,
        questions: prev.questions.filter(q => q.id !== id)
      }));
    }
  };

  const distributePointsEqually = () => {
    if (compForm.questions.length === 0) return;
    const pointsPerQuestion = Math.floor(100 / compForm.questions.length);
    let remainder = 100 % compForm.questions.length;
    
    setCompForm(prev => ({
      ...prev,
      questions: prev.questions.map((q) => {
        let p = pointsPerQuestion;
        if (remainder > 0) { p += 1; remainder -= 1; }
        return { ...q, points: p };
      })
    }));
  };

  const handleSaveComponente = async () => {
    if (!compForm.name.trim()) return showAlert("El nombre del componente es requerido", "warning");
    const totalPoints = compForm.questions.reduce((acc, q) => acc + q.points, 0);
    if (totalPoints !== 100 && compForm.questions.length > 0) {
       return showAlert(`La suma de los puntos debe ser exactamente 100. Actualmente es: ${totalPoints}`, "warning");
    }

    try {
      if (compForm.id) {
        await supabase.from('preguntas_componentes').update({
          name: compForm.name, questions: compForm.questions
        }).eq('id', compForm.id);
      } else {
        await supabase.from('preguntas_componentes').insert([{
          categoria_id: compForm.categoria_id, name: compForm.name, questions: compForm.questions
        }]);
      }
      setEditingCompId(null);
      fetchData();
      showAlert("Componente guardado exitosamente", "success");
    } catch (error: any) {
      showAlert("Error al guardar componente: " + error.message, "error");
    }
  };

  const handleDeleteComponente = async (id: string) => {
    if (await showConfirm("¿Estás seguro de eliminar este componente?")) {
      await supabase.from('preguntas_componentes').delete().eq('id', id);
      fetchData();
    }
  };

  // Filtrado de categorías por pestaña activa
  // Por defecto, si una categoría no tiene tipo, se asume que es 'Tienda' por retrocompatibilidad.
  const filteredCategorias = categorias.filter(c => {
    const tipo = c.tipo || 'Tienda';
    return tipo === activeTab;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Configuración General</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-4xl">
            Administra el catálogo de categorías y componentes físicos que serán auditados durante las visitas. Aquí puedes crear y mantener las estructuras de evaluación, agregando preguntas específicas y asignando puntuaciones para determinar el estado de cada activo, tanto para Tiendas como para Oficinas.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button 
            onClick={() => setActiveTab('Tienda')}
            className={`flex-1 py-4 flex items-center justify-center font-medium transition-colors ${activeTab === 'Tienda' ? 'border-b-2 border-brand-dark text-brand-dark bg-brand-dark/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <Store className="w-5 h-5 mr-2" /> Tiendas
          </button>
          <button 
            onClick={() => setActiveTab('Oficina')}
            className={`flex-1 py-4 flex items-center justify-center font-medium transition-colors ${activeTab === 'Oficina' ? 'border-b-2 border-brand-dark text-brand-dark bg-brand-dark/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <Building className="w-5 h-5 mr-2" /> Oficinas
          </button>
        </div>
      </div>

      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold text-gray-800">Categoría y componentes</h2>
          <button onClick={() => { setCategoriaForm({id: '', nombre: ''}); setEditingCategoria('new'); }} className="bg-brand-dark text-white px-4 py-2 rounded-lg flex items-center hover:bg-brand-hover transition-colors text-sm font-medium shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" /> Nueva Categoría
          </button>
        </div>

        {loadingCategorias ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : filteredCategorias.map(cat => {
          const isExpanded = expandedCats.includes(cat.id);
          const catComponents = componentes.filter(c => c.categoria_id === cat.id);
          
          return (
            <div key={cat.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className={`p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50 border-b border-gray-100' : ''}`} onClick={() => toggleCatExpansion(cat.id)}>
                <div className="flex items-center">
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400 mr-2" /> : <ChevronRight className="w-5 h-5 text-gray-400 mr-2" />}
                  <h3 className="font-bold text-gray-800 text-lg">{cat.nombre}</h3>
                  <span className="ml-3 bg-brand-dark/10 text-brand-dark px-2.5 py-0.5 rounded-full text-xs font-bold">{catComponents.length} Componentes</span>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setCategoriaForm({id: cat.id, nombre: cat.nombre}); setEditingCategoria(cat.id); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteCategoria(cat.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 bg-gray-50/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-sm text-gray-600">Componentes de esta categoría</h4>
                    <button onClick={() => handleCreateComponente(cat.id)} className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 font-medium flex items-center">
                      <Plus className="w-3 h-3 mr-1" /> Añadir Componente
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {catComponents.length === 0 && (
                      <div className="text-center py-6 text-sm text-gray-400 border border-dashed rounded-xl bg-white">No hay componentes configurados en esta categoría.</div>
                    )}
                    
                    {catComponents.map(comp => (
                      <div key={comp.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-start shadow-sm">
                        <div>
                          <div className="flex items-center text-brand-dark font-bold mb-1">
                            <Layers className="w-4 h-4 mr-2 opacity-50" />
                            {comp.name}
                          </div>
                          <p className="text-xs text-gray-500 ml-6">{comp.questions?.length || 0} preguntas de evaluación (Suma: {comp.questions?.reduce((a,b)=>a+b.points,0)||0} pts)</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditComponente(comp)} className="text-blue-600 bg-blue-50 p-1.5 rounded hover:bg-blue-100"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteComponente(comp.id)} className="text-red-600 bg-red-50 p-1.5 rounded hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filteredCategorias.length === 0 && !loadingCategorias && (
          <div className="text-center py-12 text-gray-500 bg-white border border-dashed rounded-2xl">
            <Tags className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-600">No hay categorías configuradas para {activeTab.toLowerCase()}s</p>
            <p className="text-sm mt-1">Crea la primera categoría para empezar a configurar el árbol.</p>
          </div>
        )}
      </div>

      {/* Floating Modal for Category Editing */}
      {editingCategoria && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-xl font-bold">{categoriaForm.id ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button onClick={() => setEditingCategoria(null)} className="text-gray-400 hover:text-gray-800"><X className="w-5 h-5"/></button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de la Categoría</label>
              <input type="text" value={categoriaForm.nombre} onChange={e => setCategoriaForm({...categoriaForm, nombre: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:border-brand-dark focus:ring-1 focus:ring-brand-dark outline-none" placeholder="Ej: Computación" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingCategoria(null)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200">Cancelar</button>
              <button onClick={handleSaveCategoria} className="bg-brand-dark text-white px-5 py-2 rounded-lg font-bold flex items-center hover:bg-brand-hover"><Save className="w-4 h-4 mr-2"/> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Modal for Component Editing */}
      {editingCompId && renderComponentEditorModal()}
    </div>
  );

  function renderComponentEditorModal() {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95">
          <div className="flex justify-between items-center border-b p-5">
            <h4 className="text-xl font-bold text-gray-800">{compForm.id ? 'Editando Componente' : 'Nuevo Componente'}</h4>
            <button onClick={() => setEditingCompId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
          </div>
          
          <div className="p-5 overflow-y-auto space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Componente</label>
              <input type="text" value={compForm.name} onChange={e => setCompForm({...compForm, name: e.target.value})} className="w-full md:w-1/2 border border-gray-300 p-2.5 rounded-lg font-bold focus:border-brand-dark focus:ring-1 focus:ring-brand-dark outline-none" placeholder="Ej: Impresora Zebra" />
            </div>

            <div className="bg-gray-50 border rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h5 className="font-bold text-sm text-gray-700">Preguntas de Evaluación para {compForm.name || 'este componente'}</h5>
                <div className="space-x-2 flex">
                  <button onClick={distributePointsEqually} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-200">Distribución Equitativa</button>
                  <button onClick={addQuestionToComp} className="text-xs bg-brand-dark text-white px-3 py-1.5 rounded-lg font-medium hover:bg-brand-hover flex items-center"><Plus className="w-3 h-3 mr-1"/> Pregunta</button>
                </div>
              </div>
              
              {compForm.questions.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-white border border-dashed rounded-lg">
                  <p className="text-sm">No has agregado ítems/preguntas para este componente.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {compForm.questions.map((q, i) => (
                    <div key={q.id} className="flex gap-3 items-start bg-white p-3 rounded-lg border shadow-sm">
                      <div className="flex-1">
                        <input type="text" value={q.text} onChange={e => updateQuestion(q.id, 'text', e.target.value)} className="w-full border-b border-transparent hover:border-gray-300 focus:border-brand-dark focus:ring-0 p-1 text-sm bg-transparent outline-none transition-colors" placeholder={`Ítem a evaluar ${i+1}...`} />
                      </div>
                      <div className="w-24">
                        <div className="flex items-center bg-gray-50 border rounded p-1">
                          <input type="number" value={q.points} onChange={e => updateQuestion(q.id, 'points', parseInt(e.target.value)||0)} className="w-full text-center bg-transparent font-bold text-sm text-brand-dark outline-none" />
                          <span className="text-xs text-gray-500 mr-1">pts</span>
                        </div>
                      </div>
                      <button onClick={() => removeQuestion(q.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar ítem"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
                  <div className="text-right pt-3 flex items-center justify-end gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Suma Total:</span>
                    <span className={`font-black text-lg px-2 py-0.5 rounded ${compForm.questions.reduce((a,b)=>a+b.points,0) === 100 ? 'text-green-700 bg-green-100' : 'text-red-600 bg-red-100 flex items-center gap-1'}`}>
                      {compForm.questions.reduce((a,b)=>a+b.points,0) !== 100 && <AlertTriangle className="w-4 h-4"/>}
                      {compForm.questions.reduce((a,b)=>a+b.points,0)}/100
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="border-t p-5 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
            <button onClick={() => setEditingCompId(null)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50">Cerrar</button>
            <button onClick={handleSaveComponente} className="bg-brand-dark text-white px-6 py-2 rounded-lg flex items-center font-bold hover:bg-brand-hover"><Save className="w-4 h-4 mr-2"/> Guardar Componente</button>
          </div>
        </div>
      </div>
    );
  }
}
