import 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: any;
  }
}
