pipeline {
  agent any

  environment {
    AWS_REGION     = 'ap-south-1'
    AWS_ACCOUNT_ID = '503301154174'
    ECR_REPO       = "503301154174.dkr.ecr.ap-south-1.amazonaws.com/uat-baatein-backend"
    ECS_CLUSTER    = 'uat-cluster'
    ECS_SERVICE    = 'uat-baatein-backend-service'
    IMAGE_TAG      = "${env.BUILD_NUMBER}"
    SONAR_TOKEN    = credentials('SONAR_TOKEN')
    }

  stages {

    stage('📥 Checkout') {
      steps {
        git branch: 'main',
            url: 'https://github.com/KumarAnkit2017/baatein-node-backend.git'
        echo "✅ Code pulled from GitHub"
      }
    }

    stage('📦 Install Dependencies') {
      steps {
        sh 'npm install'
        echo "✅ Dependencies installed"
      }
    }

    stage('🔍 SonarQube Analysis') {
      steps {
        withSonarQubeEnv('SonarQube') {
          sh """
            sonar-scanner \
              -Dsonar.projectKey=baatein-backend-uat \
              -Dsonar.projectName="Baatein Backend UAT" \
              -Dsonar.sources=. \
              -Dsonar.exclusions=node_modules/**,coverage/** \
              -Dsonar.host.url=http://YOUR_SONAR_IP:9000 \
              -Dsonar.login=${SONAR_TOKEN}
          """
        }
      }
    }

    stage('✅ Quality Gate') {
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('🐳 Docker Build') {
      steps {
        sh """
          docker build \
            -t ${ECR_REPO}:${IMAGE_TAG} \
            -t ${ECR_REPO}:latest \
            .
        """
        echo "✅ Docker image built: ${IMAGE_TAG}"
      }
    }

    stage('🔒 Trivy Security Scan') {
      steps {
        sh """
          trivy image \
            --exit-code 1 \
            --severity HIGH,CRITICAL \
            --no-progress \
            ${ECR_REPO}:${IMAGE_TAG}
        """
      }
      post {
        failure { echo "❌ Vulnerabilities found! Fix karo pehle." }
      }
    }

    stage('📤 Push to ECR') {
      steps {
        sh """
          aws ecr get-login-password --region ${AWS_REGION} | \
            docker login --username AWS --password-stdin \
            ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

          docker push ${ECR_REPO}:${IMAGE_TAG}
          docker push ${ECR_REPO}:latest
        """
        echo "✅ Image pushed to ECR"
      }
    }

    stage('🚀 Deploy to ECS UAT') {
      steps {
        sh """
          aws ecs update-service \
            --cluster ${ECS_CLUSTER} \
            --service ${ECS_SERVICE} \
            --force-new-deployment \
            --region ${AWS_REGION}
        """
        echo "🚀 ECS deployment triggered"
      }
    }

    stage('❤️ Health Check') {
      steps {
        sh """
          echo "Waiting for ECS to stabilize..."
          aws ecs wait services-stable \
            --cluster ${ECS_CLUSTER} \
            --services ${ECS_SERVICE} \
            --region ${AWS_REGION}
          echo "✅ UAT is LIVE!"
        """
      }
    }
  }

  post {
    success { echo "🎉 BUILD #${BUILD_NUMBER} — UAT Deployed Successfully!" }
    failure { echo "💥 BUILD #${BUILD_NUMBER} — FAILED! Check logs." }
    always  { sh "docker system prune -f || true" }
  }
}