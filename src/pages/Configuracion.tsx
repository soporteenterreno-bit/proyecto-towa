import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Settings, Tags, CheckSquare, Plus, Edit2, Trash2, Save, X, ListPlus, ChevronDown, ChevronRight, Layers } from 'lucide-react';
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
}

export default function Configuracion() {
  usePageTitle('Configuración');
  const { showAlert, showConfirm } = useNotification();
  const [activeTab, setActiveTab] = useState<'categorias' | 'checklist'>('categorias');
  
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

  // Checklist state (General Checklist)
  const [preguntas, setPreguntas] = useState<any[]>([]);
  const [loadingPreguntas, setLoadingPreguntas] = useState(true);
  const [editingPregunta, setEditingPregunta] = useState<any>(null);
  const [preguntaForm, setPreguntaForm] = useState({ id: '', pregunta: '', formularios: [] as string[], orden: 0, activo: true });

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

  const fetchPreguntas = async () => {
    setLoadingPreguntas(true);
    const { data } = await supabase.from('checklist_preguntas').select('*').order('orden');
    if (data) setPreguntas(data);
    setLoadingPreguntas(false);
  };

  useEffect(() => {
    if (activeTab === 'categorias') fetchData();
    else fetchPreguntas();
  }, [activeTab]);

  const toggleCatExpansion = (catId: string) => {
    setExpandedCats(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);
  };

  // --- Handlers para Categorías ---
  const handleSaveCategoria = async () => {
    if (!categoriaForm.nombre.trim()) return showAlert("El nombre es requerido", "warning");
    try {
      if (categoriaForm.id) {
        await supabase.from('categorias_inventario').update({ nombre: categoriaForm.nombre }).eq('id', categoriaForm.id);
      } else {
        await supabase.from('categorias_inventario').insert([{ nombre: categoriaForm.nombre }]);
      }
      setEditingCategoria(null);
      fetchData();
    } catch (e: any) {
      alert("Error: " + e.message);
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

  const removeQuestion = (id: string) => {
    setCompForm(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }));
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


  // --- Handlers para Checklist General ---
  const handleSavePregunta = async () => {
    if (!preguntaForm.pregunta.trim()) return showAlert("La pregunta es requerida", "warning");
    try {
      if (preguntaForm.id) {
        await supabase.from('checklist_preguntas').update({
          pregunta: preguntaForm.pregunta, formularios: preguntaForm.formularios, orden: preguntaForm.orden, activo: preguntaForm.activo
        }).eq('id', preguntaForm.id);
      } else {
        await supabase.from('checklist_preguntas').insert([{
          pregunta: preguntaForm.pregunta, formularios: preguntaForm.formularios, orden: preguntaForm.orden, activo: preguntaForm.activo
        }]);
      }
      setEditingPregunta(null);
      fetchPreguntas();
      showAlert("Pregunta guardada exitosamente", "success");
    } catch (e: any) {
      showAlert("Error: " + e.message, "error");
    }
  };

  const handleDeletePregunta = async (id: string) => {
    if(!(await showConfirm("¿Seguro que deseas eliminar esta pregunta?"))) return;
    await supabase.from('checklist_preguntas').delete().eq('id', id);
    fetchPreguntas();
  };

  const toggleFormulario = (f: string) => {
    setPreguntaForm(prev => {
      if (prev.formularios.includes(f)) return { ...prev, formularios: prev.formularios.filter(x => x !== f) };
      return { ...prev, formularios: [...prev.formularios, f] };
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Configuración General</h1>
          <p className="text-gray-500 text-sm mt-1">Administra categorías, componentes y sus preguntas de evaluación.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button 
            onClick={() => setActiveTab('categorias')}
            className={`flex-1 py-4 flex items-center justify-center font-medium transition-colors ${activeTab === 'categorias' ? 'border-b-2 border-brand-dark text-brand-dark bg-brand-dark/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <Tags className="w-5 h-5 mr-2" /> Categorías y Componentes
          </button>
          <button 
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 py-4 flex items-center justify-center font-medium transition-colors ${activeTab === 'checklist' ? 'border-b-2 border-brand-dark text-brand-dark bg-brand-dark/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <CheckSquare className="w-5 h-5 mr-2" /> Checklist General
          </button>
        </div>
      </div>

      {activeTab === 'categorias' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-gray-800">Árbol de Categorías</h2>
            <button onClick={() => { setCategoriaForm({id: '', nombre: ''}); setEditingCategoria('new'); }} className="bg-brand-dark text-white px-4 py-2 rounded-lg flex items-center hover:bg-brand-hover transition-colors text-sm font-medium shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" /> Nueva Categoría
            </button>
          </div>
          
          {editingCategoria && (
            <div className="bg-white p-5 rounded-xl border-2 border-brand-dark shadow-sm flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre de la Categoría</label>
                <input type="text" value={categoriaForm.nombre} onChange={e => setCategoriaForm({...categoriaForm, nombre: e.target.value})} className="w-full border p-2 rounded-lg" placeholder="Ej: Computación" />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={handleSaveCategoria} className="bg-brand-dark text-white px-4 py-2 rounded-lg flex items-center flex-1 justify-center"><Save className="w-4 h-4 mr-1.5"/> Guardar</button>
                <button onClick={() => setEditingCategoria(null)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center flex-1 justify-center"><X className="w-4 h-4 mr-1.5"/> Cancelar</button>
              </div>
            </div>
          )}

          {loadingCategorias ? (
            <div className="text-center text-gray-500 py-8">Cargando...</div>
          ) : categorias.map(cat => {
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
                      {catComponents.length === 0 && !editingCompId?.includes(cat.id) && (
                        <div className="text-center py-6 text-sm text-gray-400 border border-dashed rounded-xl bg-white">No hay componentes configurados en esta categoría.</div>
                      )}
                      
                      {catComponents.map(comp => (
                        editingCompId === comp.id ? renderComponentEditor() : (
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
                        )
                      ))}

                      {editingCompId && compForm.categoria_id === cat.id && !compForm.id && renderComponentEditor()}

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'checklist' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center mb-4">
             <h2 className="text-lg font-semibold text-gray-800">Preguntas de Checklist (Aplica a todas las visitas)</h2>
             <button onClick={() => { setPreguntaForm({id: '', pregunta: '', formularios: ['Programada', 'Falla'], orden: preguntas.length + 1, activo: true}); setEditingPregunta('new'); }} className="bg-brand-dark text-white px-4 py-2 rounded-lg flex items-center hover:bg-brand-hover transition-colors text-sm font-medium shadow-sm">
               <Plus className="w-4 h-4 mr-1.5" /> Nueva Pregunta
             </button>
           </div>
           
           {editingPregunta && (
             <div className="bg-white p-5 rounded-xl border-2 border-brand-dark shadow-sm space-y-4">
               <div>
                 <label className="block text-xs font-medium text-gray-500 mb-1">Pregunta / Tarea</label>
                 <input type="text" value={preguntaForm.pregunta} onChange={e => setPreguntaForm({...preguntaForm, pregunta: e.target.value})} className="w-full border p-2 rounded-lg text-sm" placeholder="Ej: ¿Se encuentra limpio el lugar?" />
               </div>
               <div className="flex flex-col md:flex-row gap-4">
                 <div className="flex-1">
                   <label className="block text-xs font-medium text-gray-500 mb-1">Aplica en Mantenimientos:</label>
                   <div className="flex gap-4 mt-2">
                     <label className="flex items-center text-sm"><input type="checkbox" checked={preguntaForm.formularios.includes('Programada')} onChange={() => toggleFormulario('Programada')} className="mr-2" /> Programados</label>
                     <label className="flex items-center text-sm"><input type="checkbox" checked={preguntaForm.formularios.includes('Falla')} onChange={() => toggleFormulario('Falla')} className="mr-2" /> De Falla</label>
                   </div>
                 </div>
                 <div className="w-32">
                   <label className="block text-xs font-medium text-gray-500 mb-1">Orden</label>
                   <input type="number" value={preguntaForm.orden} onChange={e => setPreguntaForm({...preguntaForm, orden: parseInt(e.target.value)||0})} className="w-full border p-2 rounded-lg text-sm" />
                 </div>
                 <div className="flex gap-2 items-end">
                   <button onClick={handleSavePregunta} className="bg-brand-dark text-white px-4 py-2 rounded-lg flex items-center flex-1 justify-center"><Save className="w-4 h-4 mr-1.5"/> Guardar</button>
                   <button onClick={() => setEditingPregunta(null)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center flex-1 justify-center"><X className="w-4 h-4 mr-1.5"/> Cancelar</button>
                 </div>
               </div>
             </div>
           )}

           {loadingPreguntas ? (
             <div className="text-center text-gray-500 py-8">Cargando preguntas...</div>
           ) : (
             <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
               {preguntas.map((p, index) => (
                 <div key={p.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                   <div className="flex items-center">
                     <div className="w-8 h-8 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center font-bold text-sm mr-4 shrink-0">{p.orden}</div>
                     <div>
                       <h3 className="font-medium text-gray-800 text-sm md:text-base">{p.pregunta}</h3>
                       <div className="flex gap-2 mt-1">
                         {p.formularios.map((f: string) => <span key={f} className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">{f}</span>)}
                       </div>
                     </div>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => { setPreguntaForm({id: p.id, pregunta: p.pregunta, formularios: p.formularios, orden: p.orden, activo: p.activo}); setEditingPregunta(p.id); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                     <button onClick={() => handleDeletePregunta(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                   </div>
                 </div>
               ))}
               {preguntas.length === 0 && <div className="p-8 text-center text-gray-500">No hay preguntas de checklist general configuradas.</div>}
             </div>
           )}
        </div>
      )}
    </div>
  );

  function renderComponentEditor() {
    return (
      <div className="bg-white border-2 border-brand-dark rounded-xl p-5 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-2">
        <div className="flex justify-between items-center border-b pb-3">
          <h4 className="font-bold text-gray-800">{compForm.id ? 'Editando Componente' : 'Nuevo Componente'}</h4>
          <button onClick={() => setEditingCompId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del Componente</label>
          <input type="text" value={compForm.name} onChange={e => setCompForm({...compForm, name: e.target.value})} className="w-full md:w-1/2 border p-2 rounded-lg font-bold" placeholder="Ej: Impresora Zebra" />
        </div>

        <div className="bg-gray-50 border rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h5 className="font-bold text-sm text-gray-700">Preguntas de Evaluación para {compForm.name || 'este componente'}</h5>
            <div className="space-x-2">
              <button onClick={distributePointsEqually} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-200">Distribución Equitativa</button>
              <button onClick={addQuestionToComp} className="text-xs bg-brand-dark text-white px-3 py-1.5 rounded-lg font-medium hover:bg-brand-hover">+ Pregunta</button>
            </div>
          </div>
          
          {compForm.questions.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-2">No has agregado preguntas para este componente.</p>
          ) : (
            <div className="space-y-2">
              {compForm.questions.map((q, i) => (
                <div key={q.id} className="flex gap-3 items-start bg-white p-3 rounded-lg border shadow-sm">
                  <div className="flex-1">
                    <input type="text" value={q.text} onChange={e => updateQuestion(q.id, 'text', e.target.value)} className="w-full border-b border-transparent hover:border-gray-300 focus:border-brand-dark focus:ring-0 p-1 text-sm bg-transparent" placeholder={`Pregunta ${i+1}...`} />
                  </div>
                  <div className="w-20">
                    <div className="flex items-center">
                      <input type="number" value={q.points} onChange={e => updateQuestion(q.id, 'points', parseInt(e.target.value)||0)} className="w-full text-center border p-1 rounded font-bold text-sm text-brand-dark" />
                      <span className="text-xs text-gray-500 ml-1">pts</span>
                    </div>
                  </div>
                  <button onClick={() => removeQuestion(q.id)} className="text-red-500 p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <div className="text-right pt-2 text-xs font-bold text-gray-500">
                Total Puntos: <span className={compForm.questions.reduce((a,b)=>a+b.points,0) === 100 ? 'text-green-600 text-sm' : 'text-red-500 text-sm'}>{compForm.questions.reduce((a,b)=>a+b.points,0)}/100</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleSaveComponente} className="bg-brand-dark text-white px-6 py-2 rounded-lg flex items-center font-bold hover:bg-brand-hover"><Save className="w-4 h-4 mr-2"/> Guardar Componente</button>
        </div>
      </div>
    );
  }
}
