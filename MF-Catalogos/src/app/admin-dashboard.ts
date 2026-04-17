import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormArray } from '@angular/forms';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

// PrimeNG 21
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DatePicker } from 'primeng/datepicker';
import { PrimeNG } from 'primeng/config';

// Modelos y Servicios
import { ReportData, EstadoConfig, FiltroRequest } from './remote-entry/models/report.model';
import { ReportService } from './remote-entry/services/report.service';

type TagSeverity = "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | undefined;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    CheckboxModule,
    ButtonModule,
    TableModule,
    TagModule,
    DatePicker,
    TooltipModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboard implements OnInit {


  filterForm!: FormGroup;

  // Configuración de estados
  estadosList: EstadoConfig[] = [];
  
  // Lista de archivos disponibles
  archivosList: string[] = [];

  // Datos y estado
  reportData = signal<ReportData[]>([]);
  filteredData = signal<ReportData[]>([]);
  isLoading = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    private reportService: ReportService,
    private primeng: PrimeNG
  ) {
    this.estadosList = this.reportService.obtenerEstadoConfig();
    this.archivosList = this.reportService.obtenerArchivos();
    this.initializeForm();
  }

  ngOnInit(): void {
    this._configurarIdioma();
    this._cargarDatos();
  }

  /**
   * Configura el idioma español para el datepicker
   */
  private _configurarIdioma(): void {
    this.primeng.setTranslation({
      dayNames: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
      dayNamesShort: ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"],
      dayNamesMin: ["D", "L", "M", "X", "J", "V", "S"],
      monthNames: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
      monthNamesShort: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
      today: 'Hoy',
      clear: 'Limpiar',
      dateFormat: 'dd/mm/yy',
      firstDayOfWeek: 1
    });
  }

  /**
   * Carga los datos iniciales desde el servicio
   */
  private _cargarDatos(): void {
    this.isLoading.set(true);
    this.reportService.obtenerTodos().subscribe({
      next: (datos) => {
        this.reportData.set(datos);
        this.filteredData.set(datos);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error al cargar datos:', error);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Inicializa el formulario reactivo sin suscripción automática
   */
  private initializeForm(): void {
    this.filterForm = this.fb.group({
      fechaDesde: [null],
      fechaHasta: [null],
      estados: this.fb.array(this.estadosList.map(() => false)),
      archivos: this.fb.array(this.archivosList.map(() => false))
    });
  }

  /**
   * Ejecuta la búsqueda con filtros (se dispara al presionar botón "Buscar")
   */
  onSearch(): void {
    this.isLoading.set(true);
    
    const formValue = this.filterForm.value;
    const estadosSeleccionados = this.estadosList
      .filter((_, i) => formValue.estados[i])
      .map(e => e.key);
    const archivosSeleccionados = this.archivosList
      .filter((_, i) => formValue.archivos[i]);

    // Ajustar fechas: agregar hora 00:00:00 para inicio y 23:59:59 para fin
    let fechaDesde = undefined;
    let fechaHasta = undefined;

    if (formValue.fechaDesde) {
      fechaDesde = new Date(formValue.fechaDesde);
      fechaDesde.setHours(0, 0, 0, 0); // Inicio del día
    }

    if (formValue.fechaHasta) {
      fechaHasta = new Date(formValue.fechaHasta);
      fechaHasta.setHours(23, 59, 59, 999); // Fin del día
    }

    const filtro: FiltroRequest = {
      fechaDesde,
      fechaHasta,
      estados: estadosSeleccionados.length > 0 ? estadosSeleccionados : undefined,
      archivos: archivosSeleccionados.length > 0 ? (archivosSeleccionados as any) : undefined
    };

    this.reportService.buscar(filtro).subscribe({
      next: (response) => {
        this.filteredData.set(response.datos);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error en búsqueda:', error);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Limpia los filtros del formulario y recarga todos los datos
   */
  onClear(): void {
    this.filterForm.reset({
      fechaDesde: null,
      fechaHasta: null,
      estados: this.estadosList.map(() => false),
      archivos: this.archivosList.map(() => false)
    });

    // Recarga todos los datos
    this.isLoading.set(true);
    this.reportService.obtenerTodos().subscribe({
      next: (datos) => {
        this.filteredData.set(datos);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error al cargar datos:', error);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Obtiene el label de un estado
   */
  getEstadoLabel(estado: string): string {
    const item = this.estadosList.find(e => e.key === estado);
    return item ? item.label : estado;
  }

  /**
   * Obtiene la severidad (tipo de badge) para un estado
   */
  getEstadoSeverity(estado: string): TagSeverity {
    const item = this.estadosList.find(e => e.key === estado);
    return (item?.severity as TagSeverity) || 'secondary';
  }

  /**
   * Exporta los datos filtrados a Excel
   */
  exportToExcel(): void {
    if (this.filteredData().length === 0) {
      console.warn('No hay datos para exportar');
      return;
    }

    const data = this.filteredData().map(item => ({
      'Fecha/Hora': item.fechaHora,
      'Archivo': item.archivo,
      'Estado': this.getEstadoLabel(item.estado)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monitoreo');
    
    // Ajustar columnas
    ws['!cols'] = [
      { wch: 18 }, // Fecha/Hora
      { wch: 12 }, // Archivo
      { wch: 20 }  // Estado
    ];

    XLSX.writeFile(wb, `Reporte_Monitoreo_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  /**
   * Obtiene el getter para el FormArray de estados
   */
  get estadosArray(): FormArray {
    return this.filterForm.get('estados') as FormArray;
  }

  /**
   * Obtiene el getter para el FormArray de archivos
   */
  get archivosArray(): FormArray {
    return this.filterForm.get('archivos') as FormArray;
  }

  /**
   * Obtiene la etiqueta de un archivo
   */
  getArchivoLabel(archivo: string): string {
    const labels: Record<string, string> = {
      'MO': 'Módulo Operativo',
      'MD': 'Módulo Datos',
      'ME': 'Módulo Exportación',
      'FL': 'Flujo Logístico'
    };
    return labels[archivo] || archivo;
  }

  /**
   * Muestra modal con detalles del reporte
   */
  showDetailModal(report: ReportData): void {
    if (!report) return;

    // Construir la línea de tiempo en HTML
    const timelineHtml = report.timeline
      ? report.timeline.map(item => `
          <div class="timeline-item">
            <div class="timeline-marker">
              <span class="timeline-dot"></span>
            </div>
            <div class="timeline-content">
              <p class="timeline-state">${this.getEstadoLabel(item.estado)}</p>
              <p class="timeline-time">${item.fechaHora}</p>
              <p class="timeline-description">${item.descripcion || ''}</p>
            </div>
          </div>
        `).join('')
      : '<p>No hay histórico disponible</p>';

    const htmlContent = `
      <div class="detail-modal-content">
        <div class="detail-section">
          <label>Archivo:</label>
          <span class="detail-value">${this.getArchivoLabel(report.archivo)}</span>
        </div>
        
        <div class="detail-section">
          <label>Origen:</label>
          <span class="detail-value">API-${this.getArchivoLabel(report.archivo)}</span>
        </div>
        
        <div class="detail-section">
          <label>Línea de Tiempo:</label>
          <div class="timeline-container">
            ${timelineHtml}
          </div>
        </div>
      </div>
    `;

    Swal.fire({
      title: 'Detalle del Reporte',
      html: htmlContent,
      width: '600px',
      didOpen: () => {
        const container = Swal.getHtmlContainer();
        if (container) {
          const style = document.createElement('style');
          style.textContent = `
            .detail-modal-content {
              text-align: left;
              padding: 20px;
            }
            .detail-section {
              margin-bottom: 20px;
            }
            .detail-section label {
              font-weight: bold;
              color: #333;
              display: block;
              margin-bottom: 8px;
            }
            .detail-value {
              color: #666;
              padding: 8px 12px;
              background-color: #f5f5f5;
              border-radius: 4px;
              display: inline-block;
            }
            .timeline-container {
              border-left: 3px solid #0ea5e9;
              padding-left: 20px;
              margin-top: 10px;
            }
            .timeline-item {
              display: flex;
              margin-bottom: 20px;
              position: relative;
            }
            .timeline-marker {
              position: absolute;
              left: -29px;
              top: 0;
            }
            .timeline-dot {
              display: inline-block;
              width: 12px;
              height: 12px;
              background-color: #0ea5e9;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 0 0 3px #0ea5e9;
            }
            .timeline-content {
              margin-top: -5px;
            }
            .timeline-state {
              font-weight: bold;
              color: #333;
              margin: 0 0 5px 0;
            }
            .timeline-time {
              font-size: 0.85rem;
              color: #888;
              margin: 0 0 5px 0;
            }
            .timeline-description {
              color: #666;
              margin: 0;
              font-size: 0.9rem;
            }
          `;
          container.appendChild(style);
        }
      },
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Descargar',
      denyButtonText: 'Reenviar',
      cancelButtonText: 'Regenerar',
      confirmButtonColor: '#10b981',
      denyButtonColor: '#f59e0b',
      cancelButtonColor: '#0ea5e9'
    }).then((result) => {
      if (result.isConfirmed) {
        this.onDownload(report);
      } else if (result.isDenied) {
        this.onResend(report);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.onRegenerate(report);
      }
    });
  }

  /**
   * Descargar reporte
   */
  onDownload(report: ReportData): void {
    const data = [
      {
        'ID': report.id,
        'Fecha/Hora': report.fechaHora,
        'Archivo': this.getArchivoLabel(report.archivo),
        'Estado': this.getEstadoLabel(report.estado)
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle');

    ws['!cols'] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 }
    ];

    XLSX.writeFile(wb, `Reporte_Detalle_${report.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    Swal.fire({
      icon: 'success',
      title: 'Descargado',
      text: 'El reporte ha sido descargado exitosamente',
      timer: 2000
    });
  }

  /**
   * Reenviar reporte
   */
  onResend(report: ReportData): void {
    Swal.fire({
      title: 'Reenviar Reporte',
      text: `¿Deseas reenviar el reporte ID ${report.id}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, reenviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: 'success',
          title: 'Reenviado',
          text: 'El reporte ha sido reenviado exitosamente',
          timer: 2000
        });
      }
    });
  }

  /**
   * Regenerar reporte
   */
  onRegenerate(report: ReportData): void {
    Swal.fire({
      title: 'Regenerar Reporte',
      text: `¿Deseas regenerar el reporte ID ${report.id}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, regenerar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0ea5e9'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: 'success',
          title: 'Regenerado',
          text: 'El reporte ha sido regenerado exitosamente',
          timer: 2000
        });
      }
    });
  }

}
