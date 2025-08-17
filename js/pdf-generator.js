// PDF Generator for exporting quiz answers
class PDFGenerator {
    constructor(latexParser, auth) {
        this.latexParser = latexParser;
        this.auth = auth;
    }

    async generatePDF(fileName) {
        console.log('Starting PDF generation...');
        
        const progressContainer = document.querySelector('.pdf-progress-container');
        const progressBar = document.getElementById('pdfProgress');
        
        if (progressContainer && progressBar) {
            progressContainer.style.display = 'block';
            progressBar.value = 0;
        }

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            let isFirstPage = true;

            const sections = this.latexParser.getSections();
            const questions = this.latexParser.getQuestions();

            if (sections.length > 0) {
                await this.generateSectionsPDF(pdf, sections, progressBar, isFirstPage);
            } else if (questions.length > 0) {
                await this.generateQuestionsPDF(pdf, questions, progressBar, isFirstPage);
            } else {
                throw new Error('No content to generate PDF');
            }

            // Generate filename
            const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'quiz';
            const user = this.auth.getCurrentUser();
            const namePart = user ? user.displayName.replace(/\s+/g, '_') : 'student';
            const timestamp = new Date().toISOString().split('T')[0];
            
            pdf.save(`${baseName}-${namePart}-${timestamp}.pdf`);
            console.log('PDF generated successfully');

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF: ' + error.message);
        } finally {
            if (progressContainer) {
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 1000);
            }
        }
    }

    async generateSectionsPDF(pdf, sections, progressBar, isFirstPage) {
        let totalParts = 0;
        sections.forEach(section => {
            totalParts += section.questions.reduce((acc, q) => acc + q.parts.length, 0);
        });
        
        let processedParts = 0;

        for (const [sectionIndex, section] of sections.entries()) {
            if (!isFirstPage) pdf.addPage();
            isFirstPage = false;
            
            // Add section title
            pdf.setFontSize(18);
            pdf.setFont(undefined, 'bold');
            pdf.text(section.title, 15, 30);
            
            for (const question of section.questions) {
                for (const part of question.parts) {
                    if (!isFirstPage) pdf.addPage();
                    isFirstPage = false;

                    await this.addQuestionPartToPDF(pdf, question, part, sectionIndex);

                    processedParts++;
                    if (progressBar) {
                        progressBar.value = Math.round((processedParts / totalParts) * 100);
                    }
                }
            }
        }
    }

    async generateQuestionsPDF(pdf, questions, progressBar, isFirstPage) {
        const totalParts = questions.reduce((acc, q) => acc + q.parts.length, 0);
        let processedParts = 0;

        for (const question of questions) {
            for (const part of question.parts) {
                if (!isFirstPage) pdf.addPage();
                isFirstPage = false;

                await this.addQuestionPartToPDF(pdf, question, part);

                processedParts++;
                if (progressBar) {
                    progressBar.value = Math.round((processedParts / totalParts) * 100);
                }
            }
        }
    }

    async addQuestionPartToPDF(pdf, question, part, sectionIndex = null) {
        let yPos = 20;

        // Find question and part elements
        const questionSelector = sectionIndex !== null 
            ? `[data-section="${sectionIndex}"][data-question="${question.id}"] .question-text`
            : `[data-question="${question.id}"] .question-text`;
            
        const partSelector = sectionIndex !== null 
            ? `[data-section="${sectionIndex}"][data-question="${question.id}"][data-part="${part.id}"] .part-text`
            : `[data-question="${question.id}"][data-part="${part.id}"] .part-text`;

        const questionTextElement = document.querySelector(questionSelector);
        const partTextElement = document.querySelector(partSelector);

        try {
            // Wait for MathJax to render
            if (window.MathJax) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Add question text
            if (questionTextElement) {
                const questionCanvas = await html2canvas(questionTextElement, { 
                    scale: 2, 
                    backgroundColor: '#ffffff',
                    useCORS: true
                });
                const questionImgData = questionCanvas.toDataURL('image/png');
                const questionImgWidth = Math.min(170, questionCanvas.width * 0.25);
                const questionImgHeight = questionCanvas.height * (questionImgWidth / questionCanvas.width);
                pdf.addImage(questionImgData, 'PNG', 15, yPos, questionImgWidth, questionImgHeight);
                yPos += questionImgHeight + 8;
            }

            // Add part text
            if (partTextElement && part.text) {
                const partCanvas = await html2canvas(partTextElement, { 
                    scale: 2, 
                    backgroundColor: '#ffffff',
                    useCORS: true
                });
                const partImgData = partCanvas.toDataURL('image/png');
                const partImgWidth = Math.min(170, partCanvas.width * 0.25);
                const partImgHeight = partCanvas.height * (partImgWidth / partCanvas.width);
                pdf.addImage(partImgData, 'PNG', 15, yPos, partImgWidth, partImgHeight);
                yPos += partImgHeight + 15;
            } else {
                yPos += 15;
            }

        } catch (error) {
            console.warn('Failed to render question/part as image, using fallback:', error);
            
            // Fallback to text
            const questionText = `Question ${question.id}: ${question.text}`;
            const partText = part.text ? `Part ${part.id}: ${part.text}` : '';
            
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            const questionLines = pdf.splitTextToSize(questionText, 170);
            pdf.text(questionLines, 15, yPos);
            yPos += questionLines.length * 6 + 5;

            if (partText) {
                pdf.setFont(undefined, 'normal');
                const partLines = pdf.splitTextToSize(partText, 170);
                pdf.text(partLines, 15, yPos);
                yPos += partLines.length * 6 + 15;
            }
        }

        // Add canvas drawing
        const canvasSelector = sectionIndex !== null 
            ? `canvas[data-section="${sectionIndex}"][data-question="${question.id}"][data-part="${part.id}"]`
            : `canvas[data-question="${question.id}"][data-part="${part.id}"]`;
            
        const canvas = document.querySelector(canvasSelector);
        if (canvas) {
            try {
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = Math.min(170, canvas.width * 0.35);
                const imgHeight = canvas.height * (imgWidth / canvas.width);
                
                // Ensure we don't exceed page boundaries
                if (yPos + imgHeight > 270) { // A4 height is about 297mm
                    pdf.addPage();
                    yPos = 20;
                }
                
                pdf.addImage(imgData, 'PNG', 15, yPos, imgWidth, imgHeight);
            } catch (error) {
                console.warn('Failed to add canvas to PDF:', error);
            }
        }
    }

    showProgress(value) {
        const progressBar = document.getElementById('pdfProgress');
        if (progressBar) {
            progressBar.value = value;
        }
    }

    hideProgress() {
        const progressContainer = document.querySelector('.pdf-progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }
}