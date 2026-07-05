import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, UploadCloud, CheckCircle, AlertCircle, FileText, Download, User as UserIcon, Calendar, MapPin, Building, Briefcase, Camera, X, XCircle, Navigation, Clock, LogIn, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const programadaActivities = [
  {
    id: 'prog_1',
    title: 'Inspección y Levantamiento Físico',
    subActivities: [
      { text: 'Realizar una inspección presencial para identificar ubicación de cada activo.', points: 10 },
      { text: 'Registrar modelos, marcas y números de serie de cada dispositivo.', points: 15 }
    ]
  },
  {
    id: 'prog_2',
    title: 'Evaluación de Infraestructura',
    subActivities: [
      { text: 'Auditar conectividad de sistemas.', points: 15 },
      { text: 'Inspeccionar el gabinete principal (rack) y cableado.', points: 10 }
    ]
  }
];

const fallaActivities = [
  {
    id: 'fall_1',
    title: 'Diagnóstico de la Falla General',
    subActivities: [
      { text: 'Aislar el fallo original que detonó el incidente.', points: 25 },
      { text: 'Comprobar conexiones de red y energía.', points: 25 }
    ]
  }
];

type SubActivity = {
    id: string;
    text: string;
    points: number;
    isCompleted: boolean | null;
    reason: string;
};

type ActivityState = {
    id: string;
    title: string;
    subActivities: SubActivity[];
    images: string[];
};

export default function FormularioVisita() {
  const { visitaId } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  
  const [visita, setVisita] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [items, setItems] = useState<ActivityState[]>([]);
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [validationError, setValidationError] = useState<{ messages: string[], sectionId: string | null } | null>(null);

  // GPS restriction state
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'checking' | 'ok' | 'too_far' | 'no_coords' | 'denied'>('idle');
  const [distanceToStore, setDistanceToStore] = useState<number | null>(null);

  const pdfRef = useRef<HTMLDivElement>(null);

  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlambda = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    const fetchFullData = async () => {
      if (!visitaId) return;
      try {
          const vSnap = await getDoc(doc(db, 'visitas', visitaId));
          if (!vSnap.exists()) {
             alert('Visita no encontrada');
             navigate('/visitas/mis-visitas');
             return;
          }
          const vData = { id: vSnap.id, ...vSnap.data() } as any;

          // Fetch Tienda
          if (vData.id_tienda) {
              const tSnap = await getDoc(doc(db, 'tiendas', vData.id_tienda));
              if (tSnap.exists()) vData.tienda = tSnap.data();
          }

          // Fetch Tecnico
          if (vData.tecnico_uid) {
              const techSnap = await getDoc(doc(db, 'users', vData.tecnico_uid));
              if (techSnap.exists()) {
                  vData.tecnicoInfo = techSnap.data();
                  if (vData.tecnicoInfo.jefe_inmediato) {
                      try {
                          const jefeSnap = await getDoc(doc(db, 'users', vData.tecnicoInfo.jefe_inmediato));
                          if (jefeSnap.exists()) {
                              vData.tecnicoInfo.jefeInfo = jefeSnap.data();
                          }
                      } catch(e) { console.warn(e) }
                  }
              }
          }
          
          setVisita(vData);

          // Init State
          if(vData.actividades_ejecutadas && vData.actividades_ejecutadas.length > 0) {
             setItems(vData.actividades_ejecutadas);
             setNotas(vData.notas_adicionales || '');
          } else {
             let actsBase: any[] = [];

             if (vData.componentes_afectados && vData.componentes_afectados.length > 0) {
                 // Fetch custom questions for these components
                 // Firebase doesn't allow 'in' with > 10 items, but we'll assume less than 10 components selected
                 try {
                     const compChunks = [];
                     for (let i = 0; i < vData.componentes_afectados.length; i += 10) {
                         const chunk = vData.componentes_afectados.slice(i, i + 10);
                         const qComp = query(collection(db, 'preguntas_componentes'), where(documentId(), 'in', chunk));
                         const compSnap = await getDocs(qComp);
                         compSnap.forEach(d => {
                            const data = d.data();
                            actsBase.push({
                                id: d.id,
                                title: data.name,
                                subActivities: data.questions || []
                            });
                         });
                     }
                 } catch(err) { console.error("Error fetching componentes", err); }
             }

             // Fallback if no components or empty fetch
             if (actsBase.length === 0) {
                 actsBase = vData.tipo === 'Falla' ? fallaActivities : programadaActivities;
             }

             setItems(actsBase.map(a => ({
                 id: a.id,
                 title: a.title,
                 subActivities: a.subActivities.map((sub: any, idx: number) => ({
                     id: `${a.id}-${sub.id || idx}`,
                     text: sub.text,
                     points: sub.points || 0,
                     isCompleted: null,
                     reason: ''
                 })),
                 images: []
             })));
          }

      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
    };
    fetchFullData();
  }, [visitaId, navigate]);

  // GPS check
  useEffect(() => {
    if (!visita || visita.status === 'Completada') return;
    if (!user || user.uid !== visita.tecnico_uid) return;

    const coords = visita.tienda?.coordenadas;
    if (!coords?.lat || !coords?.lng) {
      setGpsStatus('no_coords');
      return;
    }

    setGpsStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, coords.lat, coords.lng);
        const rounded = Math.round(dist);
        setDistanceToStore(rounded);
        setGpsStatus(rounded <= 100 ? 'ok' : 'too_far');
      },
      () => { setGpsStatus('denied'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [visita?.id, user, visita?.tienda, visita?.tecnico_uid, visita?.status]);

  // Derived state for scoring
  const calculateScores = () => {
      let totalPts = 0;
      let earnedPts = 0;
      let componentScores = items.map(item => {
          let itemTotal = 0;
          let itemEarned = 0;
          item.subActivities.forEach(sub => {
              const pts = sub.points || 10; // default points if 0 to avoid zero div
              itemTotal += pts;
              totalPts += pts;
              if (sub.isCompleted === true) {
                  itemEarned += pts;
                  earnedPts += pts;
              }
          });
          return {
              id: item.id,
              title: item.title,
              total: itemTotal,
              earned: itemEarned,
              percentage: itemTotal > 0 ? Math.round((itemEarned / itemTotal) * 100) : 0
          };
      });

      const totalPercentage = totalPts > 0 ? Math.round((earnedPts / totalPts) * 100) : 0;
      return { totalPercentage, componentScores, totalPts, earnedPts };
  };

  const scoresInfo = calculateScores();
  const currPonderacion = scoresInfo.totalPercentage;

  // Auto-save logic
  useEffect(() => {
     if (!visita || visita.status === 'Completada') return;
     const timeoutId = setTimeout(() => {
         if (visita.status === 'En Curso' || visita.status === 'Pendiente') {
            updateDoc(doc(db, 'visitas', visita.id), {
                ponderacion_final: currPonderacion,
                actividades_ejecutadas: items,
                notas_adicionales: notas
            }).catch(e => console.warn("Background auto-save failed", e));
         }
     }, 2500);
     return () => clearTimeout(timeoutId);
  }, [items, notas, currPonderacion, visita]);


  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000;
                let scaleSize = 1;
                if(img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
  };

  const updateSubStatus = (itemId: string, subId: string, status: boolean) => {
      setItems(prev => prev.map(item => {
          if (item.id === itemId) {
              return {
                  ...item,
                  subActivities: item.subActivities.map(sub => 
                      sub.id === subId ? { ...sub, isCompleted: status, reason: status ? '' : sub.reason } : sub
                  )
              };
          }
          return item;
      }));
  };

  const updateSubReason = (itemId: string, subId: string, reason: string) => {
      setItems(prev => prev.map(item => {
          if (item.id === itemId) {
              return {
                  ...item,
                  subActivities: item.subActivities.map(sub => 
                      sub.id === subId ? { ...sub, reason } : sub
                  )
              };
          }
          return item;
      }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, activityId: string) => {
      const files = Array.from(e.target.files || []) as File[];
      if(files.length === 0) return;

      const compressedImages = await Promise.all(files.map(f => compressImage(f)));
      
      setItems(prev => prev.map(item => {
          if(item.id === activityId) {
              return { ...item, images: [...item.images, ...compressedImages] };
          }
          return item;
      }));
  };

  const removeImage = (activityId: string, indexToRemove: number) => {
      setItems(prev => prev.map(item => {
        if(item.id === activityId) {
            return { ...item, images: item.images.filter((_, i) => i !== indexToRemove) };
        }
        return item;
      }));
  };

  const handleCompleteVisit = async () => {
      let firstErrorSec: string | null = null;
      let errorMsgs: string[] = [];

      for(const item of items) {
          let hasSubError = false;
          for(const sub of item.subActivities) {
              if(sub.isCompleted === null) {
                  hasSubError = true;
                  errorMsgs.push(`• Falta elegir el estado (Completado / No Completado) en la tarea: "${sub.text}" de la actividad ${item.title}`);
                  if(!firstErrorSec) firstErrorSec = `activity-${item.id}`;
              }
              if(sub.isCompleted === false && !sub.reason.trim()) {
                  hasSubError = true;
                  errorMsgs.push(`• Debes justificar la razón si no has completado la tarea: "${sub.text}" de la actividad ${item.title}`);
                  if(!firstErrorSec) firstErrorSec = `activity-${item.id}`;
              }
          }
          if(item.images.length === 0) {
              errorMsgs.push(`• Debes subir al menos 1 imagen de evidencia general para la actividad: ${item.title}`);
              if(!firstErrorSec) firstErrorSec = `activity-${item.id}`;
          }
      }

      if (errorMsgs.length > 0) {
          setValidationError({
              messages: errorMsgs.slice(0, 5),
              sectionId: firstErrorSec
          });
          if(firstErrorSec) {
              const el = document.getElementById(firstErrorSec);
              if (el) {
                  setTimeout(() => {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('ring-4', 'ring-red-400', 'ring-offset-8', 'rounded-2xl', 'transition-all', 'duration-500');
                      setTimeout(() => {
                         el.classList.remove('ring-4', 'ring-red-400', 'ring-offset-8', 'rounded-2xl', 'transition-all', 'duration-500');
                      }, 2500);
                  }, 50);
              }
          }
          return;
      }

      setValidationError(null);
      setSaving(true);
      try {
          const ahora = new Date().toISOString();
          await updateDoc(doc(db, 'visitas', visitaId!), {
              status: 'Completada',
              ponderacion_final: currPonderacion,
              fecha_ejecucion: ahora,
              fecha_fin: ahora,
              notas_adicionales: notas,
              actividades_ejecutadas: items
          });

          setVisita((prev: any) => ({
             ...prev,
             status: 'Completada',
             ponderacion_final: currPonderacion,
             fecha_ejecucion: ahora,
             fecha_fin: ahora
          }));
      } catch (e) {
          console.error(e);
          alert('Error al guardar el formulario.');
      } finally {
          setSaving(false);
      }
  };

  const downloadPDF = async () => {
      setDownloading(true);
      try {
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
          
          const brandDark = [17, 24, 39]; // Gray 900
          const brandTheme = [22, 63, 58]; // Towa Green

          const getBase64ImageFromUrl = async (imageUrl: string) => {
              try {
                  const res = await fetch(imageUrl);
                  const blob = await res.blob();
                  return new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.addEventListener("load", function () {
                          resolve(reader.result as string);
                      }, false);
                      reader.onerror = () => reject("error");
                      reader.readAsDataURL(blob);
                  });
              } catch (e) {
                  return null;
              }
          };

          let logoData = await getBase64ImageFromUrl('/logo.png');

          // Header
          if (logoData) {
              pdf.addImage(logoData, 'PNG', 15, 12, 35, 23);
          } else {
             pdf.setFontSize(22);
             pdf.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
             pdf.text('Towa', 15, 25);
          }
          
          pdf.setFontSize(18);
          pdf.setTextColor(brandTheme[0], brandTheme[1], brandTheme[2]);
          pdf.text('Informe de Ejecución Técnica', 60, 22);
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Fecha de Emisión: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 60, 28);
          pdf.text(`Tipo de Intervención: ${visita.tipo} ${visita.tt_number ? '| TT: ' + visita.tt_number : ''}`, 60, 33);
          if (visita.prioridad) {
              pdf.text(`Prioridad: ${visita.prioridad}`, 60, 38);
          }

          // Divider
          pdf.setDrawColor(220, 220, 220);
          pdf.line(15, 42, 200, 42);

          // Info Header
          let currentY = 48;
          pdf.setFontSize(11);
          pdf.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
          pdf.setFont("helvetica", "bold");
          pdf.text("DATOS DEL DESTINO", 15, currentY);
          pdf.text("PERSONAL ASIGNADO", 110, currentY);

          currentY += 6;
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(60, 60, 60);
          
          pdf.text(`Agencia: ${visita.tienda?.codigo_tienda} - ${visita.tienda?.establecimiento_cc}`, 15, currentY);
          pdf.text(`Técnico: ${visita.tecnicoInfo?.nombre || 'No definido'}`, 110, currentY);
          
          currentY += 6;
          pdf.text(`Ubicación: ${visita.tienda?.ciudad}, ${visita.tienda?.pais}`, 15, currentY);
          pdf.text(`Jefe Inmediato: ${visita.tecnicoInfo?.jefeInfo?.nombre || visita.tecnicoInfo?.jefe_inmediato || 'No asignado'}`, 110, currentY);
          
          currentY += 6;
          pdf.text(`Fecha Programada: ${format(new Date(visita.fecha_programada), "dd/MM/yyyy")}`, 15, currentY);
          pdf.text(`Área: ${visita.tecnicoInfo?.area_trabajo || 'General'}`, 110, currentY);
          
          currentY += 6;
          if (visita.fecha_inicio) {
            pdf.text(`Hora de Entrada: ${format(new Date(visita.fecha_inicio), "dd/MM/yyyy - HH:mm")}`, 15, currentY);
          }
          pdf.setFont("helvetica", "bold");
          pdf.text(`Puntuación Global: ${visita.ponderacion_final !== undefined ? visita.ponderacion_final + '%' : '---'}`, 110, currentY);
          pdf.setFont("helvetica", "normal");

          if (visita.fecha_fin || visita.fecha_ejecucion) {
            currentY += 6;
            pdf.text(`Hora de Salida: ${format(new Date(visita.fecha_fin || visita.fecha_ejecucion), "dd/MM/yyyy - HH:mm")}`, 15, currentY);
            if (visita.fecha_inicio) {
              const durMin = Math.round((new Date(visita.fecha_fin || visita.fecha_ejecucion).getTime() - new Date(visita.fecha_inicio).getTime()) / 60000);
              const durStr = durMin >= 60 ? `${Math.floor(durMin/60)}h ${durMin%60}m` : `${durMin} min`;
              pdf.setFont("helvetica", "bold");
              pdf.text(`Tiempo de Gestión: ${durStr}`, 110, currentY);
              pdf.setFont("helvetica", "normal");
            }
          }

          currentY += 12;

          // Scores Summary Table
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(brandTheme[0], brandTheme[1], brandTheme[2]);
          pdf.text("RESUMEN DE PUNTUACIÓN POR COMPONENTES", 15, currentY);
          currentY += 4;
          
          const scoresData = scoresInfo.componentScores.map(comp => [
             comp.title,
             `${comp.total} pts`,
             `${comp.earned} pts`,
             `${comp.percentage}%`
          ]);

          autoTable(pdf, {
              startY: currentY,
              head: [['Componente / Área', 'Puntos Posibles', 'Puntos Obtenidos', 'Porcentaje (%)']],
              body: scoresData,
              theme: 'grid',
              styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
              columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
              headStyles: { fillColor: [240, 240, 240], textColor: brandDark as [number, number, number] },
          });

          currentY = (pdf as any).lastAutoTable.finalY + 12;

          // Main Activities Table
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
          pdf.text("DETALLE DE EJECUCIÓN (PREGUNTAS)", 15, currentY);
          currentY += 4;

          const tableData: any[][] = [];
          items.forEach((item) => {
               item.subActivities.forEach((sub, subIdx) => {
                   let status = "Pendiente";
                   if (sub.isCompleted === true) status = "Completada";
                   if (sub.isCompleted === false) status = "No Realizada";
                   
                   tableData.push([
                       subIdx === 0 ? item.title : '', 
                       sub.text,
                       `${sub.points} pts`,
                       status,
                       sub.reason || '-'
                   ]);
               });
          });

          autoTable(pdf, {
              startY: currentY,
              head: [['Componente', 'Pregunta / Tarea', 'Puntos', 'Estado', 'Razón / Observación']],
              body: tableData,
              theme: 'grid',
              styles: { fontSize: 8, cellPadding: 3 },
              headStyles: { fillColor: brandDark as [number, number, number], textColor: [255, 255, 255] },
              columnStyles: {
                  0: { cellWidth: 35, fontStyle: 'bold' },
                  1: { cellWidth: 70 },
                  2: { cellWidth: 15, halign: 'center' },
                  3: { cellWidth: 20 },
                  4: { cellWidth: 45 },
              },
              rowPageBreak: 'avoid',
              didParseCell: function(data) {
                   if (data.row.raw[3] === 'No Realizada' && data.column.dataKey === 3) {
                       data.cell.styles.textColor = [200, 0, 0];
                       data.cell.styles.fontStyle = 'bold';
                   } else if (data.row.raw[3] === 'Completada' && data.column.dataKey === 3) {
                       data.cell.styles.textColor = [0, 150, 0];
                       data.cell.styles.fontStyle = 'bold';
                   }
              }
          });

          currentY = (pdf as any).lastAutoTable.finalY + 10;

          // Notes
          if (notas) {
               if (currentY > 240) { pdf.addPage(); currentY = 20; }
               pdf.setFont("helvetica", "bold");
               pdf.setFontSize(11);
               pdf.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
               pdf.text("NOTAS ADICIONALES", 15, currentY);
               
               pdf.setFont("helvetica", "italic");
               pdf.setFontSize(9);
               pdf.setTextColor(80, 80, 80);
               
               const splitNotes = pdf.splitTextToSize(notas, 180);
               pdf.text(splitNotes, 15, currentY + 6);
               currentY += (splitNotes.length * 5) + 12;
          }

          // Annexes (Images)
          const itemsWithImages = items.filter(i => i.images && i.images.length > 0);
          if (itemsWithImages.length > 0) {
               pdf.addPage();
               currentY = 20;
               pdf.setFont("helvetica", "bold");
               pdf.setFontSize(14);
               pdf.setTextColor(brandTheme[0], brandTheme[1], brandTheme[2]);
               pdf.text("ANEXOS FOTOGRÁFICOS", 15, currentY);
               currentY += 10;

               for (const item of itemsWithImages) {
                   if (currentY > 240) { pdf.addPage(); currentY = 20; }
                   
                   pdf.setFontSize(11);
                   pdf.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
                   pdf.text(`Componente: ${item.title}`, 15, currentY);
                   currentY += 6;

                   let startX = 15;
                   const imgWidth = 55;
                   const imgHeight = 55;
                   const rowHeight = imgHeight + 8;

                   for (let k = 0; k < item.images.length; k++) {
                       if (startX + imgWidth > 200) {
                           startX = 15;
                           currentY += rowHeight;
                           if (currentY > 230) {
                               pdf.addPage();
                               currentY = 20;
                           }
                       }
                       try {
                           pdf.addImage(item.images[k], 'JPEG', startX, currentY, imgWidth, imgHeight);
                       } catch(e) { console.warn("Img draw failed", e) }
                       
                       startX += imgWidth + 5;
                   }
                   currentY += rowHeight + 8;
               }
          }

          // Footer Timestamp
          const pageCount = (pdf.internal as any).getNumberOfPages();
          for(let i = 1; i <= pageCount; i++) {
              pdf.setPage(i);
              pdf.setFontSize(7);
              pdf.setTextColor(150);
              pdf.text(`Documento Formateado por Towa TechManager - Página ${i} de ${pageCount}`, 105, 275, { align: 'center' });
          }

          pdf.save(`Reporte_TOWA_${visita.tienda?.codigo_tienda || 'Indef'}.pdf`);
      } catch (e) {
          console.error(e);
          alert('Error generando PDF nativo');
      } finally {
          setDownloading(false);
      }
  };


  if (loading) return <div className="p-8 text-center text-gray-500">Cargando formulario...</div>;
  if (!visita) return <div className="p-8 text-center text-red-500">Error cargando visita.</div>;

  const isCompleted = visita.status === 'Completada';
  const isOwner = user?.uid === visita.tecnico_uid;

  const allSubsCompleted = items.flatMap(i => i.subActivities).filter(s => s.isCompleted === true);
  const allSubsNotCompleted = items.flatMap(i => i.subActivities).filter(s => s.isCompleted === false);

  const showGpsOverlay = !isCompleted && isOwner && (gpsStatus === 'checking' || gpsStatus === 'too_far' || gpsStatus === 'denied');

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 px-2 sm:px-0">

      {showGpsOverlay && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            {gpsStatus === 'checking' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                  <Navigation className="w-8 h-8 text-blue-500 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Verificando ubicación GPS...</h3>
                <p className="text-sm text-gray-500">Validando que te encuentras en la tienda asignada. Por favor, activa el GPS y espera.</p>
              </>
            )}
            {gpsStatus === 'too_far' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Fuera del rango permitido</h3>
                <p className="text-sm text-gray-500 mb-2">Debes estar a <strong>menos de 100 metros</strong> de la tienda para procesar esta visita.</p>
                <p className="text-2xl font-extrabold text-red-600 mb-1">{distanceToStore} m</p>
                <p className="text-xs text-gray-400 mb-5">distancia actual a la tienda</p>
                <button
                  onClick={() => {
                    const coords = visita?.tienda?.coordenadas;
                    if (!coords?.lat) { setGpsStatus('no_coords'); return; }
                    setGpsStatus('checking');
                    navigator.geolocation.getCurrentPosition(
                      pos => { const d = Math.round(haversineDistance(pos.coords.latitude, pos.coords.longitude, coords.lat, coords.lng)); setDistanceToStore(d); setGpsStatus(d <= 100 ? 'ok' : 'too_far'); },
                      () => setGpsStatus('denied'),
                      { enableHighAccuracy: true, timeout: 15000 }
                    );
                  }}
                  className="w-full mb-2 px-4 py-2.5 bg-brand-dark text-white rounded-xl font-semibold text-sm hover:bg-brand-hover transition-colors"
                >
                  Reintentar verificación
                </button>
                <button onClick={() => navigate(-1)} className="w-full px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
                  Volver
                </button>
              </>
            )}
            {gpsStatus === 'denied' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">GPS no disponible</h3>
                <p className="text-sm text-gray-500 mb-5">No se pudo acceder a tu ubicación. Activa los permisos de GPS en tu dispositivo y recarga, o contacta a tu coordinador.</p>
                <button onClick={() => setGpsStatus('ok')} className="w-full mb-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 transition-colors">
                  Continuar sin GPS (bajo responsabilidad)
                </button>
                <button onClick={() => navigate(-1)} className="w-full px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
                  Volver
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100">
         <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-brand-dark transition-colors font-medium text-sm sm:text-base">
             <ArrowLeft className="w-5 h-5 mr-2" /> <span className="hidden sm:inline">Volver</span>
         </button>
         
         {isCompleted && (
             <button onClick={downloadPDF} disabled={downloading} className="flex items-center bg-brand-dark text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm sm:text-base font-medium hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-50">
                 {downloading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                 {downloading ? 'Generando...' : 'Descargar PDF'}
             </button>
         )}
      </div>

      <div id="reporte-pdf" ref={pdfRef} className="bg-white rounded-2xl shadow-sm border border-brand-dark/10 overflow-hidden">
          
          <div className="p-5 sm:p-8 border-b border-gray-100 bg-brand-gray/30 relative">
             <div className="mb-3 flex items-center gap-2 flex-wrap">
                 <span className={`inline-flex px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider items-center ${visita.tipo === 'Falla' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                     {visita.tipo === 'Falla' ? <AlertCircle className="w-3 h-3 mr-1"/> : <FileText className="w-3 h-3 mr-1"/>}
                     Visita {visita.tipo}
                 </span>
                 {visita.prioridad && (
                     <span className="inline-flex px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
                         Prio: {visita.prioridad}
                     </span>
                 )}
                 {visita.tt_number && <span className="text-[10px] sm:text-sm font-mono text-gray-500 font-semibold border border-gray-200 px-2 py-0.5 rounded-lg">TT: {visita.tt_number}</span>}
             </div>

             <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-6 font-sans tracking-tight">Informe de Ejecución Técnica</h1>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm">
                 <div className="space-y-3 sm:space-y-4">
                     <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Datos del Destino</h3>
                     <div className="flex items-start">
                         <Building className="w-4 h-4 text-brand-dark mt-0.5 mr-3 shrink-0" />
                         <div>
                             <p className="text-sm font-bold text-gray-800">{visita.tienda?.codigo_tienda} - {visita.tienda?.establecimiento_cc}</p>
                             <p className="text-xs text-gray-500">{visita.tienda?.ciudad}, {visita.tienda?.pais}</p>
                         </div>
                     </div>
                     <div className="flex items-start">
                         <Calendar className="w-4 h-4 text-brand-dark mr-3 shrink-0 mt-0.5" />
                         <div className="space-y-1">
                             <p className="text-sm text-gray-800 font-medium">Prog: {format(new Date(visita.fecha_programada), "dd/MMM/yyyy", {locale: es}).toUpperCase()}</p>
                             {visita.fecha_inicio && (
                               <p className="text-[10px] sm:text-xs text-emerald-700 font-semibold flex items-center">
                                 <LogIn className="w-3 h-3 mr-1"/>Entrada: {format(new Date(visita.fecha_inicio), "dd/MM/yy - HH:mm")}
                               </p>
                             )}
                             {(visita.fecha_fin || visita.fecha_ejecucion) && (
                               <p className="text-[10px] sm:text-xs text-red-600 font-semibold flex items-center">
                                 <LogOut className="w-3 h-3 mr-1"/>Salida: {format(new Date(visita.fecha_fin || visita.fecha_ejecucion), "dd/MM/yy - HH:mm")}
                               </p>
                             )}
                         </div>
                     </div>
                 </div>

                 <div className="space-y-3 sm:space-y-4">
                     <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Personal Asignado</h3>
                     <div className="flex items-center">
                         <UserIcon className="w-4 h-4 text-brand-dark mr-3 shrink-0" />
                         <div>
                             <p className="text-sm font-bold text-gray-800">{visita.tecnicoInfo?.nombre || 'Técnico'}</p>
                             <p className="text-[10px] sm:text-xs text-gray-500">Técnico Funcionario</p>
                         </div>
                     </div>
                     <div className="flex items-center">
                         <Briefcase className="w-4 h-4 text-brand-dark mr-3 shrink-0" />
                         <div>
                             <p className="text-sm text-gray-800 font-medium whitespace-nowrap">Área: {visita.tecnicoInfo?.area_trabajo || 'General'}</p>
                             <p className="text-[10px] sm:text-xs text-gray-500">Jefe Inmediato: {visita.tecnicoInfo?.jefeInfo?.nombre || visita.tecnicoInfo?.jefe_inmediato || 'No asignado'}</p>
                         </div>
                     </div>
                 </div>
             </div>
          </div>

          {/* Scores Ponderation Header */}
          <div className="bg-brand-dark text-white px-6 py-4 flex justify-between items-center">
              <div>
                 <h2 className="text-sm font-bold uppercase tracking-wider">Puntuación Global</h2>
                 <p className="text-xs text-white/70">Calculado en base a {scoresInfo.totalPts} puntos totales</p>
              </div>
              <div className="text-3xl font-black">{isCompleted ? visita.ponderacion_final : currPonderacion}%</div>
          </div>

          <div className="p-4 sm:p-8">
              
              <div className="mb-8">
                 <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-2 border-b-2 border-brand-dark inline-block pb-1">Evaluación de Componentes</h2>
                 <p className="text-xs sm:text-sm text-gray-500 mb-6">Completa las preguntas para cada componente evaluado.</p>
                 
                 <div className="space-y-6 sm:space-y-8">
                    {items.map((item, idx) => {
                        const compScore = scoresInfo.componentScores.find(c => c.id === item.id);
                        return (
                        <div key={item.id} id={`activity-${item.id}`} className="relative pl-6 sm:pl-0 scroll-mt-24">
                            <div className="absolute left-0 top-0 sm:relative sm:left-auto sm:top-auto sm:mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                                <div className="flex items-center">
                                    <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-brand-dark text-white flex items-center justify-center text-[10px] sm:text-sm font-bold">
                                        {idx + 1}
                                    </div>
                                    <h3 className="hidden sm:block ml-3 text-base sm:text-lg font-bold text-gray-800 mt-0.5">{item.title}</h3>
                                </div>
                                <div className="hidden sm:block text-sm font-bold text-gray-500">
                                    {compScore?.earned} / {compScore?.total} pts ({compScore?.percentage}%)
                                </div>
                            </div>
                            
                            <div className="sm:ml-11 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="p-4 sm:p-6 pb-4">
                                     <div className="sm:hidden flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
                                         <h3 className="text-sm font-bold text-brand-dark">{item.title}</h3>
                                         <span className="text-xs font-bold text-gray-500">{compScore?.earned}/{compScore?.total} pts</span>
                                     </div>
                                     
                                     <div className="space-y-4 mb-6">
                                        {item.subActivities.map((sub) => (
                                            <div key={sub.id} className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200/60 shadow-sm flex flex-col lg:flex-row gap-4">
                                                <div className="flex-1">
                                                    <p className="text-xs sm:text-sm text-gray-700 font-medium mb-1 leading-relaxed">{sub.text}</p>
                                                    <p className="text-[10px] font-bold text-brand-dark uppercase">Valor: {sub.points} pts</p>
                                                </div>
                                                
                                                <div className="w-full lg:w-72">
                                                    {!isCompleted && isOwner ? (
                                                        <div className="space-y-3">
                                                            <div className="flex gap-2">
                                                                <button 
                                                                  type="button"
                                                                  onClick={() => updateSubStatus(item.id, sub.id, true)} 
                                                                  className={`flex-1 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-semibold border transition-colors ${sub.isCompleted === true ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                                                                >
                                                                    Aprobado ✅
                                                                </button>
                                                                <button 
                                                                  type="button"
                                                                  onClick={() => updateSubStatus(item.id, sub.id, false)} 
                                                                  className={`flex-1 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-semibold border transition-colors ${sub.isCompleted === false ? 'bg-red-50 border-red-500 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                                                                >
                                                                    Rechazado ❌
                                                                </button>
                                                            </div>
                                                            {sub.isCompleted === false && (
                                                                <div className="animate-in fade-in slide-in-from-top-1">
                                                                  <textarea 
                                                                    value={sub.reason} 
                                                                    onChange={(e) => updateSubReason(item.id, sub.id, e.target.value)} 
                                                                    className="w-full text-xs p-2 bg-red-50/50 border border-red-200 rounded-lg outline-none focus:ring-1 focus:ring-red-400 placeholder-red-300 transition-all font-medium text-red-900" 
                                                                    placeholder="Especifica la razón obligatoria detallada..." 
                                                                    rows={2}
                                                                  />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-2 pt-2 border-t border-gray-100 lg:border-t-0 lg:mt-0 lg:pt-0">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${sub.isCompleted ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                                                {sub.isCompleted ? <CheckCircle className="w-3 h-3 mr-1"/> : <XCircle className="w-3 h-3 mr-1"/>}
                                                                {sub.isCompleted ? 'Aprobado' : 'Rechazado'}
                                                            </span>
                                                            {sub.isCompleted === false && (
                                                                <div className="mt-2 bg-red-50 p-2 rounded-lg border border-red-100">
                                                                    <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-1">Razón proporcionada:</p>
                                                                    <p className="text-xs text-red-900 font-medium italic">"{sub.reason}"</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                     </div>

                                     {/* Images Area */}
                                     {(!isCompleted && isOwner) ? (
                                        <div className="bg-white p-4 rounded-xl border border-gray-200 mt-2">
                                            <label className="block text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center">
                                                <Camera className="w-3 h-3 mr-1.5" /> Evidencias del {item.title} *
                                            </label>
                                            
                                            <div className="flex flex-wrap gap-2">
                                                {item.images.map((img, i) => (
                                                    <div key={i} className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-gray-200 group">
                                                        <img src={img} className="w-full h-full object-cover" />
                                                        <button 
                                                            type="button"
                                                            onClick={() => removeImage(item.id, i)} 
                                                            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <label className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 hover:border-brand-hover hover:text-brand-hover cursor-pointer transition-colors bg-gray-50 hover:bg-white text-center">
                                                    <UploadCloud className="w-4 h-4 sm:w-5 sm:h-5 mb-1" />
                                                    <span className="text-[8px] sm:text-[10px] font-semibold uppercase leading-tight">Añadir<br/>Evidencia</span>
                                                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e, item.id)} />
                                                </label>
                                            </div>
                                        </div>
                                     ) : item.images.length > 0 && (
                                         <div className="mt-4 pt-4 border-t border-gray-200">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Evidencias Adjuntas:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {item.images.map((img, i) => (
                                                    <img key={i} src={img} className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg border border-gray-200 shadow-sm" />
                                                ))}
                                            </div>
                                         </div>
                                     )}
                                </div>
                            </div>
                        </div>
                    )})}
                 </div>
              </div>

              {/* Extras & Stats */}
              <div className="bg-brand-gray border border-gray-200 p-4 sm:p-6 rounded-2xl">
                 <h3 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Desglose Final</h3>
                 
                 {isCompleted && (
                     <div className="mb-6 bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm">
                        <div className="mb-5 pb-5 border-b border-gray-100">
                          <h4 className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-3 flex items-center">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Preguntas Aprobadas ({allSubsCompleted.length})
                          </h4>
                          <ul className="space-y-2">
                             {allSubsCompleted.map((s, i) => (
                                <li key={i} className="text-xs text-gray-600 flex items-start">
                                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1 mr-2 shrink-0"></div>
                                   {s.text} <span className="font-bold ml-1 text-green-700">+{s.points}</span>
                                </li>
                             ))}
                             {allSubsCompleted.length === 0 && <p className="text-xs text-gray-400 italic">Ninguna completada.</p>}
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-3 flex items-center">
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Preguntas Rechazadas ({allSubsNotCompleted.length})
                          </h4>
                          <ul className="space-y-3">
                             {allSubsNotCompleted.map((s, i) => (
                                <li key={i} className="bg-red-50/50 p-3 rounded-lg border border-red-100/50">
                                   <p className="text-xs font-semibold text-gray-800 mb-1">{s.text}</p>
                                   <p className="text-xs text-red-700 italic border-l-2 border-red-300 pl-2">Razón: {s.reason}</p>
                                </li>
                             ))}
                             {allSubsNotCompleted.length === 0 && <p className="text-xs text-gray-400 italic">No hubo rechazos, todo se completó con éxito.</p>}
                          </ul>
                        </div>
                     </div>
                 )}

                 <div>
                     <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Notas Adicionales / Cierre</label>
                     {isCompleted ? (
                         <div className="p-3 sm:p-4 bg-white rounded-xl border border-gray-200 min-h-[80px] text-xs sm:text-sm text-gray-700 italic">
                             {notas || 'No se adjuntaron notas adicionales al cierre del servicio.'}
                         </div>
                     ) : (
                         <textarea 
                           value={notas} 
                           onChange={(e) => setNotas(e.target.value)}
                           className="w-full bg-white border border-gray-300 rounded-xl p-3 sm:p-4 text-xs sm:text-sm focus:ring-2 focus:ring-brand-dark outline-none" 
                           rows={3} 
                           placeholder="Agrega observaciones generales de la visita, recomendaciones para próximos mantenimientos..."
                         />
                     )}
                 </div>
              </div>

          </div>

          <div className="border-t border-gray-100 bg-gray-50 p-4 sm:p-6 text-center">
              <p className="text-[8px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest">Documento Generado por Plataforma Towa TechManager</p>
          </div>
      </div>

      {!isCompleted && isOwner && (
          <div className="flex justify-end pt-4 sm:pt-6">
              <button 
                  type="button"
                  onClick={handleCompleteVisit}
                  disabled={saving}
                  className="w-full sm:w-auto bg-brand-dark text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold text-base sm:text-lg hover:bg-brand-hover transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center"
              >
                  {saving ? 'Validando Reporte...' : '✔ Guardar y Completar Visita'}
              </button>
          </div>
      )}

      {validationError && (
          <div className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-[450px] bg-[#163f3a] text-white p-5 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-5">
              <div className="flex items-start">
                  <AlertCircle className="w-8 h-8 text-yellow-400 mr-3 shrink-0" />
                  <div className="flex-1">
                      <h4 className="font-bold text-base mb-2">Información Incompleta</h4>
                      <div className="text-xs text-white/90 space-y-1.5 mb-4 max-h-[150px] overflow-y-auto">
                          {validationError.messages.map((msg, i) => (
                             <p key={i} className="leading-relaxed border-l-2 border-white/20 pl-2">{msg}</p>
                          ))}
                      </div>
                      <button onClick={() => setValidationError(null)} className="text-sm bg-white text-[#163f3a] hover:bg-white/90 px-4 py-2 rounded-lg transition-colors font-bold w-full sm:w-auto">
                          Entendido, voy a completarlo
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}
